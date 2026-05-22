'use client';

/**
 * lib/hooks/useOfflineChat.ts
 * ═══════════════════════════════════════════════════════════════════
 * Drop-in replacement for the direct API call in chat/page.tsx.
 *
 * Behaviour:
 *   ONLINE  → calls backend /chat/ as usual
 *   OFFLINE → classifies locally (MiniLM or keyword), searches
 *             IndexedDB violations, returns structured response
 *
 * The hook also persists messages to IndexedDB for the History page.
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef } from 'react';
import { useNetworkStatus } from '@/components/PWAProvider';
import { classifyIntent, extractEntities, type IntentName } from '@/lib/offlineClassifier';
import { searchViolations, saveChat, type ChatSession, type ChatMessage } from '@/lib/db';
import { sendChatMessage, type ChatRequest, type ChatResponse } from '@/lib/api';
import { generateTicketId } from '@/lib/utils';

// ── Offline response builder ──────────────────────────────────────────────────

async function buildOfflineResponse(
  message: string,
  intent: IntentName,
  confidence: number
): Promise<ChatResponse> {
  const entities = extractEntities(message);

  switch (intent) {
    case 'DriveLegal': {
      const violations = await searchViolations(message, {
        country:     entities.country ?? 'India',
        vehicleType: entities.vehicleType,
        limit:       5,
      });

      if (violations.length === 0) {
        return {
          intent,
          confidence,
          response:
            `I found no exact match for "${message}" in the offline database. ` +
            `For accurate fines, please reconnect and try again, or call 112.`,
          source: 'offline-db',
        };
      }

      const top = violations[0];
      const lines = [
        `📋 **${top.violation_name}**`,
        `💰 Base fine: ₹${top.base_fine_inr.toLocaleString('en-IN')}`,
        top.enhanced_fine_inr ? `🔁 Repeat offence: ₹${top.enhanced_fine_inr.toLocaleString('en-IN')}` : '',
        top.mv_act_section ? `⚖️ ${top.mv_act_section}` : '',
        top.imprisonment ? `🔒 ${top.imprisonment}` : '',
        '',
        violations.length > 1
          ? `_Also matched: ${violations.slice(1).map((v) => v.violation_name).join(', ')}_`
          : '',
        '',
        '⚠️ _Offline data — reconnect for the latest amounts._',
      ].filter(Boolean);

      return { intent, confidence, response: lines.join('\n'), source: 'offline-db' };
    }

    case 'Emergency': {
      const country = entities.country ?? 'India';
      const numbers: Record<string, { emergency: string; ambulance: string; police: string }> = {
        India:       { emergency: '112', ambulance: '108', police: '100' },
        Bangladesh:  { emergency: '999', ambulance: '199', police: '999' },
        Nepal:       { emergency: '100', ambulance: '102', police: '100' },
        'Sri Lanka': { emergency: '119', ambulance: '110', police: '118' },
        Myanmar:     { emergency: '199', ambulance: '192', police: '199' },
        Bhutan:      { emergency: '113', ambulance: '112', police: '113' },
        Thailand:    { emergency: '191', ambulance: '1669', police: '191' },
      };
      const n = numbers[country] || numbers['India'];
      return {
        intent,
        confidence,
        response: [
          `🚨 **Emergency Contacts (${country})**`,
          `🔴 Emergency: **${n.emergency}**`,
          `🚑 Ambulance: **${n.ambulance}**`,
          `👮 Police:    **${n.police}**`,
          '',
          '📡 _You are offline. Call the number directly — GPS-based nearest services need internet._',
        ].join('\n'),
        source: 'offline-cache',
      };
    }

    case 'RoadSoS': {
      return {
        intent,
        confidence,
        response: [
          '🛠️ **Road Assistance (Offline)**',
          '',
          'You appear to be offline. For immediate roadside help:',
          '• **Highway Helpline (NHAI):** 1033',
          '• **Motor Accident Line:** 1073',
          '• **General Emergency:** 112',
          '',
          'When back online, I can locate the nearest puncture shops, towing services, and CNG stations.',
        ].join('\n'),
        source: 'offline-cache',
      };
    }

    case 'RoadWatch': {
      return {
        intent,
        confidence,
        response: [
          '📝 **Road Issue Report (Queued)**',
          '',
          'Your report has been saved offline and will be submitted automatically when connectivity is restored.',
          '',
          '• Use the **Report** tab to fill in full details',
          '• Offline reports are stored securely in your browser',
          '• They sync in the background once you reconnect',
        ].join('\n'),
        source: 'offline-queue',
      };
    }

    default:
      return {
        intent:    'Unclear',
        confidence: 0,
        response:
          "I'm currently offline. For emergencies call **112** (India). " +
          "Violation fines, emergency contacts, and road issue reporting are available offline via the tabs below.",
        source: 'offline-cache',
      };
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseOfflineChatOptions {
  country?: string;
  sessionId?: string;
}

export function useOfflineChat(options: UseOfflineChatOptions = {}) {
  const networkStatus = useNetworkStatus();
  const sessionRef    = useRef<ChatSession>({
    sessionId: options.sessionId ?? generateTicketId(),
    title:     'New Chat',
    messages:  [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    country:   options.country,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const sendMessage = useCallback(
    async (message: string, coords?: { lat: number; lon: number }): Promise<ChatResponse> => {
      setIsLoading(true);
      setError(null);

      const userMsg: ChatMessage = {
        role:      'user',
        content:   message,
        timestamp: Date.now(),
      };
      sessionRef.current.messages.push(userMsg);

      // Set chat title from first user message
      if (sessionRef.current.messages.filter((m) => m.role === 'user').length === 1) {
        sessionRef.current.title = message.slice(0, 60);
      }

      let response: ChatResponse;

      try {
        if (networkStatus === 'offline') {
          throw new Error('offline');
        }

        // ── Online path ────────────────────────────────────────────────────
        const req: ChatRequest = {
          message,
          country: options.country,
          ...(coords ?? {}),
        };
        response = await sendChatMessage(req);
      } catch (err) {
        // ── Offline path ───────────────────────────────────────────────────
        const { intent, confidence } = await classifyIntent(message);
        response = await buildOfflineResponse(message, intent as IntentName, confidence);
      } finally {
        setIsLoading(false);
      }

      // Persist assistant message to IndexedDB
      const assistantMsg: ChatMessage = {
        role:       'assistant',
        content:    response.response,
        intent:     response.intent,
        confidence: response.confidence,
        source:     response.source,
        timestamp:  Date.now(),
        isOffline:  networkStatus === 'offline',
      };
      sessionRef.current.messages.push(assistantMsg);
      sessionRef.current.updatedAt = Date.now();

      // Save to IndexedDB (fire-and-forget — don't block UI)
      saveChat(sessionRef.current).catch(console.error);

      return response!;
    },
    [networkStatus, options.country]
  );

  return { sendMessage, isLoading, error, networkStatus };
}
