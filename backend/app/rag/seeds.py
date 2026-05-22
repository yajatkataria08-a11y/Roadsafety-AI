"""
RAG Seed Chunks — MV Act 2019 & BIMSTEC Traffic Law Excerpts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hardcoded legal text chunks so the RAG index always has real content
even before any government PDFs are dropped into data/legal/pdfs/.

Source references are included in each chunk so the LLM can cite them.
These are paraphrased/summarised from public MV Act 2019 gazette text.
Add actual PDFs to data/legal/pdfs/ to supplement these.
"""

MV_ACT_SEEDS: list[str] = [
    # ── Drunk driving ──────────────────────────────────────────────────────────
    (
        "Motor Vehicles Act 2019, Section 185 — Driving by a drunken person or "
        "by a person under the influence of drugs. Whoever drives or attempts to "
        "drive a motor vehicle while having 30 mg or more of alcohol per 100 ml "
        "of blood as detected by a breath analyser shall be punishable: first "
        "offence fine of Rs 10,000 or imprisonment up to 6 months or both; "
        "second offence (within 3 years) fine of Rs 15,000 or imprisonment up "
        "to 2 years or both. Source: MV Act 2019 S.185."
    ),
    # ── Over-speeding ──────────────────────────────────────────────────────────
    (
        "Motor Vehicles Act 2019, Section 183 — Driving at excessive speed. "
        "Whoever drives a motor vehicle at a speed exceeding the maximum "
        "permissible speed shall for the first offence be fined Rs 1,000–2,000 "
        "for light vehicles and Rs 2,000–4,000 for medium/heavy vehicles. "
        "Repeat offences attract enhanced fines and possible licence suspension. "
        "Source: MV Act 2019 S.183."
    ),
    # ── Helmet ────────────────────────────────────────────────────────────────
    (
        "Motor Vehicles Act 2019, Section 129 — Wearing of protective headgear. "
        "Every person driving or riding on a motor cycle must wear a helmet of "
        "a standard specified by the Central Government. Violation is punishable "
        "under S.194D with a fine of Rs 1,000 and disqualification from holding "
        "a licence for 3 months. Source: MV Act 2019 S.129, S.194D."
    ),
    # ── Seatbelt ──────────────────────────────────────────────────────────────
    (
        "Motor Vehicles Act 2019, Section 194B — Seat belt violations. "
        "Every driver and passenger in a motor vehicle must wear a seat belt "
        "as specified. Failure to wear a seat belt attracts a fine of Rs 1,000. "
        "Source: MV Act 2019 S.194B."
    ),
    # ── Mobile phone ──────────────────────────────────────────────────────────
    (
        "Motor Vehicles Act 2019, Section 184 read with S.177 — Use of mobile "
        "phone while driving. Using a hand-held communication device while "
        "driving is an offence attracting a fine of Rs 1,000 for the first "
        "offence and Rs 10,000 for a repeat offence. Source: MV Act 2019 S.184."
    ),
    # ── Signal jumping ────────────────────────────────────────────────────────
    (
        "Motor Vehicles Act 2019, Section 177 — General provision for "
        "contravention of rules. Jumping a red traffic signal is punishable "
        "with a fine of Rs 1,000–5,000. Additionally, Section 119 mandates "
        "obedience to traffic signals and signs. Repeat offences can result "
        "in licence suspension. Source: MV Act 2019 S.177, S.119."
    ),
    # ── Driving without licence ───────────────────────────────────────────────
    (
        "Motor Vehicles Act 2019, Section 181 — Driving without a licence. "
        "Whoever drives a motor vehicle in a public place without a valid "
        "driving licence shall be punishable with a fine of Rs 5,000. "
        "If the vehicle is a transport vehicle, the fine may extend to "
        "Rs 10,000. Source: MV Act 2019 S.181."
    ),
    # ── Triple riding ─────────────────────────────────────────────────────────
    (
        "Motor Vehicles Act 2019, Section 128 and S.194C — Pillion riding "
        "restrictions. A two-wheeler shall not carry more than one pillion "
        "rider. Carrying two or more pillion riders (triple riding) attracts "
        "a fine of Rs 1,000 under S.194C. Source: MV Act 2019 S.128, S.194C."
    ),
    # ── No insurance ──────────────────────────────────────────────────────────
    (
        "Motor Vehicles Act 2019, Section 196 — Driving uninsured vehicle. "
        "Whoever drives or causes to drive a motor vehicle without a valid "
        "third-party insurance policy shall be punishable with a fine of "
        "Rs 2,000 for the first offence and Rs 4,000 for subsequent offences, "
        "or imprisonment up to 3 months. Source: MV Act 2019 S.196."
    ),
    # ── PUC / pollution ───────────────────────────────────────────────────────
    (
        "Motor Vehicles Act 2019, Section 190(2) — Pollution under control "
        "certificate (PUC). Every motor vehicle must possess a valid PUC "
        "certificate. Failure to produce a valid certificate attracts a fine "
        "of Rs 10,000 or imprisonment up to 6 months for the first offence. "
        "Source: MV Act 2019 S.190(2)."
    ),
    # ── Wrong parking ─────────────────────────────────────────────────────────
    (
        "Motor Vehicles Act 2019, Section 177 / S.122 — Improper parking. "
        "Parking a vehicle in a no-parking zone, on a footpath, near a fire "
        "hydrant, or obstructing traffic is punishable with a fine of "
        "Rs 500–1,000 under S.177. Municipal corporations may levy additional "
        "towing/clamping charges. Source: MV Act 2019 S.122, S.177."
    ),
    # ── Tinted glass ──────────────────────────────────────────────────────────
    (
        "Motor Vehicles Act 2019, Section 100 and Central Motor Vehicles Rules "
        "1989, Rule 100 — Tinted glass/window film. Vehicles must not have "
        "tinted glass with visual light transmission (VLT) below 70% for "
        "windscreen and 50% for side/rear windows. Violation attracts a fine "
        "under S.177 of the MV Act. Source: MV Act 2019 S.100, CMVR Rule 100."
    ),
    # ── Bangladesh (BRTA) ─────────────────────────────────────────────────────
    (
        "Bangladesh Road Transport Act 2018 — Key penalties. "
        "Drunk driving: fine of BDT 25,000 and/or imprisonment up to 3 years. "
        "Driving without licence: fine of BDT 25,000. "
        "Speeding: fine of BDT 10,000–25,000. "
        "Helmet violation: fine of BDT 5,000. "
        "Source: Bangladesh Road Transport Act 2018, BRTA."
    ),
    # ── Sri Lanka ─────────────────────────────────────────────────────────────
    (
        "Sri Lanka Motor Traffic Act (as amended 2023) — Key penalties. "
        "Drunk driving: fine of LKR 25,000 and/or 2 years imprisonment; "
        "repeat offence up to 5 years. "
        "Speeding: LKR 3,000–10,000. "
        "No helmet: LKR 1,000. "
        "No seat belt: LKR 1,000. "
        "Source: Sri Lanka Motor Traffic Act, Department of Motor Traffic."
    ),
    # ── Nepal ─────────────────────────────────────────────────────────────────
    (
        "Nepal Vehicle and Transport Management Act 2049 (as updated) — Key penalties. "
        "Drunk driving: fine of NPR 10,000–25,000 and/or imprisonment. "
        "No helmet: NPR 2,000. "
        "Driving without licence: NPR 5,000. "
        "Speeding: NPR 1,000–5,000. "
        "Source: Nepal Department of Transport Management (DoTM)."
    ),
    # ── Thailand ──────────────────────────────────────────────────────────────
    (
        "Thailand Land Traffic Act B.E. 2522 (as amended) — Key penalties. "
        "Drunk driving (blood alcohol > 50 mg/100 ml): fine of THB 10,000–20,000 "
        "and/or 1–2 years imprisonment; repeat within 2 years: up to 3 years. "
        "No helmet: THB 500. "
        "Speeding: THB 500–1,000. "
        "Seatbelt violation: THB 500. "
        "Source: Thailand DLT (Department of Land Transport)."
    ),
    # ── Myanmar ───────────────────────────────────────────────────────────────
    (
        "Myanmar Road Transport Law 2018 — Key penalties. "
        "Drunk driving: fine of MMK 100,000 and/or imprisonment. "
        "No helmet: MMK 10,000. "
        "Driving without licence: MMK 50,000. "
        "Speeding: MMK 30,000–100,000. "
        "Source: Myanmar Ministry of Transport and Communications."
    ),
    # ── Bhutan ────────────────────────────────────────────────────────────────
    (
        "Bhutan Road Safety and Transport Authority (RSTA) — Key fines. "
        "Drunk driving (> 80 mg/100 ml): fine of BTN 5,000 and/or 6 months "
        "imprisonment; repeat offence BTN 10,000 and 1 year imprisonment. "
        "No helmet: BTN 500. "
        "Speeding: BTN 500–3,000. "
        "No seat belt: BTN 500. "
        "Source: Bhutan RSTA."
    ),
    # ── Hit and run (clarification chunk) ─────────────────────────────────────
    (
        "Motor Vehicles Act 2019, Section 161 — Hit and run compensation scheme. "
        "In cases where a motor vehicle involved in an accident causing death or "
        "grievous hurt cannot be identified, the Solatium Fund provides: "
        "Rs 50,000 in case of death and Rs 25,000 in case of grievous hurt. "
        "This is a civil compensation mechanism, not a criminal penalty. "
        "Hit-and-run as a criminal offence is dealt with under IPC S.279/304A. "
        "Source: MV Act 2019 S.161."
    ),
    # ── BIMSTEC Road Safety Statistics ────────────────────────────────────────
    (
        "BIMSTEC Road Safety — Regional Overview 2023. "
        "The BIMSTEC region (Bangladesh, India, Myanmar, Sri Lanka, Thailand, Nepal, Bhutan) "
        "accounts for approximately 400,000 road crash deaths annually — nearly 40% of global "
        "road fatalities. India alone contributes 4.61 lakh deaths per year (WHO 2023). "
        "Thailand has the highest fatality rate per 100,000 population at 32.7. "
        "Bhutan has made the most progress with a 15% reduction over 5 years. "
        "BIMSTEC nations are committed to UN Decade of Action 2021–2030 targets: "
        "50% reduction in road deaths. Source: WHO Global Status Report 2023, BIMSTEC TWG."
    ),
    (
        "Bangladesh Road Safety — Key Facts 2023. "
        "Bangladesh records approximately 25,000 road deaths per year (official figures "
        "likely undercount by 2-3x). Dhaka city alone reports 2,800+ accidents per year. "
        "Major causes: overloading, unlicensed drivers (est. 40% of bus drivers), "
        "poor road infrastructure, lack of pedestrian crossings. "
        "Road Transport Act 2018: drunk driving penalty — imprisonment up to 3 years "
        "and/or BDT 25,000 fine. Reckless driving causing death: up to 5 years. "
        "Source: Bangladesh Road Transport Authority (BRTA), WHO Bangladesh."
    ),
    (
        "Nepal Road Safety — Terai Highway Hotspots 2023. "
        "Nepal records 2,400 road deaths annually; fatality rate of 8.3 per 100,000. "
        "Prithvi Highway and Arniko Highway are the most dangerous corridors. "
        "70% of fatalities occur on mountain roads due to poor road conditions and "
        "overloaded vehicles. Nepal Traffic Police Regulation 2071 (2014): "
        "speeding penalty NRP 1,000–5,000; drunk driving NRP 2,000 + licence suspension. "
        "Good Samaritan provisions introduced in 2019 protect first responders. "
        "Source: Nepal Department of Roads, WHO Nepal Office."
    ),
    (
        "Thailand Road Safety — Zero Vision Campaign 2023. "
        "Thailand has one of the highest road fatality rates in Asia: 20,000 deaths/yr, "
        "32.7 per 100,000 population. 70% of deaths involve motorcycles. "
        "Thailand Road Safety Centre uses AI-based black spot mapping across national "
        "highway network. Land Transport Act B.E. 2522 penalties: drunk driving (BAC > 50mg/dl) "
        "— fine THB 10,000–20,000 and/or 1 year imprisonment. "
        "Songkran Festival (April) sees highest fatality spike — 400+ deaths in 7 days. "
        "Source: Thailand Department of Land Transport, WHO Thailand."
    ),
    (
        "Sri Lanka Road Safety — Southern Expressway Corridor 2023. "
        "Sri Lanka records 3,100 road deaths per year; 16.2 per 100,000 population. "
        "Southern Expressway is highest-risk highway; speeding main cause. "
        "Motor Traffic Act penalties: speeding > 100 km/h — LKR 3,000–25,000. "
        "Drunk driving (BAC > 80mg/dl): LKR 10,000 + 12 months licence suspension. "
        "Sri Lanka has pioneered road safety audits for all new highway projects since 2020. "
        "Source: Sri Lanka National Road Safety Council."
    ),
    (
        "India BIMSTEC Comparison — Road Infrastructure Gap Analysis 2023. "
        "India's road network (6.37 million km) is the second largest in the world but "
        "carries 460,000 annual fatalities. Key issues: 70% of state highways lack "
        "crash barriers; 45% of National Highways lack adequate lighting; "
        "60% of accident vehicles exceed permissible axle load. "
        "MV Act 2019 introduced hit-and-run compensation, good samaritan protection, "
        "and electronic enforcement. E-challan system covers 850+ cities as of 2024. "
        "India's target: reduce fatality rate to < 1 per 10,000 vehicles by 2030. "
        "Source: Ministry of Road Transport & Highways (MoRTH) Annual Report 2023."
    ),
]
