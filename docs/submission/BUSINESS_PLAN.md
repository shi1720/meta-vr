# Signsprout business plan

*Prepared by Shivam Gupta, November 2026. Figures marked "estimate" are
assumptions to be validated; everything else has a source.*

## 1. Summary

Signsprout teaches sign language on Meta Quest with the learner's own hands:
a teacher signs face to face, guide hands overlay the learner's hands, and the
app checks every finger and tells them what to fix. It starts with the people
who need it most, hearing parents of deaf babies, and grows into a practice
tool for anyone learning ASL.

- **Product:** a WebXR app (a link, no install) plus a phone companion.
  Working today: 87 signs, spaced repetition, AI coach, pairing, sync.
- **Model:** free core; a Family plan at **$7.99/month or $59/year**;
  sponsored free access for families of deaf children under three; program
  licences for early-intervention services and schools (from $39 per family
  per year).
- **Costs:** static hosting and a managed database; under **$0.05 per active
  family per month** at the scale of the first year (estimate, §6).
- **Ask:** Deaf partners to co-lead content, three pilot programs, and a Meta
  VR Store listing in Q1 2027.

## 2. The problem

- More than **90% of deaf children are born to hearing parents**
  ([NIDCD](https://www.nidcd.nih.gov/health/statistics/quick-statistics-hearing)).
- Deaf children of hearing parents reach age-level ASL vocabulary when exposed
  **before 6 months**; later exposure leads to smaller vocabularies
  ([Caselli et al. 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8085057/)).
- Only **22.9%** of families with deaf children regularly sign at home
  ([Lieberman et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10785677/),
  citing GRI 2013–14 data). Parents cite **time** and **cost**; rural families
  cite access.
- Learning from video is hard for a specific reason: novices mirror the signer
  and make **24.3%** errors on lateral movements; with a model that matches the
  mirroring, lateral errors fell from **20.6% to 0.9%**
  ([Shield & Meier 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5988899/)).
  And video can't tell you if your hands are right.

## 3. The product

| Capability | Why it matters |
|---|---|
| Teacher face to face, mirrored by default | Removes the mental flip that causes novice errors |
| Guide hands on the learner's own hands | First-person demonstration; fades after two unaided successes to avoid dependence |
| Per-finger, per-parameter feedback | "Fold your ring finger down more" instead of pass/fail |
| Five-minute sessions, spaced repetition, a garden | A habit that fits a parent's day; visible progress |
| AI coach that plans from verified signs only | Personal ("bath time words") without inventing signs |
| Phone pairing, family sharing | No typing in VR; grandparents and carers can follow along |
| Web first | A link, no store approval, updates instantly, runs on Quest 2, 3, 3S and future VR glasses |

## 4. Market

**Beachhead: hearing families of deaf and hard-of-hearing (DHH) children.**
About **6,272** US infants were identified as DHH in 2022
([CDC EHDI](https://archive.cdc.gov/www_cdc_gov/ncbddd/hearingloss/2022-data/01-data-summary.html)),
so roughly **5,600** new hearing-parent families a year and about **28,000**
with a child under five. Each family has several learners (parents, siblings,
grandparents, carers). This segment is small as a consumer revenue pool but
large in need, credibility and program funding: IDEA Part C early intervention
receives **$540M a year** federally
([CRS](https://www.everycrsreport.com/files/2026-02-13_R44624_448c5b4cc8c85f62f40293931b004b70c8554fc2.html)),
and every state's EHDI program has language acquisition as a goal
([GAO-25-106978](https://www.gao.gov/products/gao-25-106978)).

**Expansion: general ASL learners.**
- ASL is the **#3 language** in US higher education, with **107,899**
  enrollments, and one of only three top-15 languages that grew from 2016 to
  2021 ([MLA](https://www.mla.org/content/download/191329/file/2021-Enrollment-Press-Release.pdf)).
- **2.8%** of US adults use sign language
  ([Mitchell & Young 2023](https://eric.ed.gov/?id=EJ1365191)).
- Lingvano grew from 500k to **2.5M learners** (2022–2024) with 2D video
  ([eSchool News](https://www.eschoolnews.com/newsline/2024/10/08/sign-language-learning-app-reaches-2-5-million-learners-milestone/)).
  Duolingo still has no ASL course.

**Platform.** Meta held 74.6% of AR/VR headset share in 2024, and education
was its fastest-growing segment (+69.4%)
([IDC](https://my.idc.com/getdoc.jsp?containerId=prUS53278025)). Meta's new
VR glasses are hands-first by design, and hand-tracked titles are shown first
to hands-only users. The main risk is headset reach (see §8), which is why
Signsprout is a web app with a phone companion and a lending model.

## 5. Business model

| Plan | Price | Who |
|---|---|---|
| **Free** | $0 | Everyone: the First words, Mealtime and Family units, fingerspelling A–Z and numbers, the garden |
| **Family** | $7.99/month or $59/year, up to 4 family members | All signs and new units, AI coach, sync, family dashboard and share links |
| **Family Pass** (sponsored) | $0 to the family | Families with a DHH child under 3, referred by early intervention, EHDI or a hospital, funded by programs and philanthropy |
| **Programs** | from $39 per family per year | Early-intervention services, audiology teams, schools for the deaf: seats, consented progress reports, headset lending kits, staff and Deaf-mentor onboarding |

Pricing sits below Lingvano ($119.99/year) and ASL Bloom ($98.99/year), and
near Duolingo Family ($119.99/year for six) per learner. **Families of deaf
babies never pay**: that is both the mission and the channel, because program
staff recommend tools they can hand out for free.

Non-dilutive funding fits this product: NSF SBIR (Phase I up to $305,000),
ED/IES SBIR ($250,000) and NIDILRR, all reauthorised through 2031.

## 6. Costs

The product is a static web app plus a small database, so costs stay low and
mostly fixed.

| Item | Free tier | At about 10,000 monthly families (estimate) |
|---|---|---|
| Hosting (static, CDN) | $0 | $0–20/month |
| Supabase (auth, Postgres, functions) | $0 (free plan) | $25/month (Pro) plus usage |
| AI coach (Claude) | Rules planner, $0 | A few cents per plan, capped at 20 plans per user per day; most families make one or two a week |
| Email (sign-in links) | Supabase built-in | About $15/month |
| **Total** | **$0** | **Roughly $100–500/month**, under $0.05 per family |

Hand tracking runs on the headset, so there are no per-user inference costs for
the core loop. Content is data (a sign is a few lines), so adding signs costs
review time rather than video production.

## 7. Competition and moat

| | Signsprout | NVIDIA Signs | Lingvano | PopSign | Quest ASL apps |
|---|---|---|---|---|---|
| Checks your own hands | ✅ 3D, 25 joints/hand | ✅ 2D webcam | Self-view camera | ✅ phone camera | ✅ (mostly letters) |
| Teacher's hands on yours (first person) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Explains what to fix | ✅ per finger and parameter | Real-time feedback (2D) | ❌ | ❌ | Limited |
| Family curriculum + spaced repetition | ✅ | ❌ | ✅ | ✅ (game) | ❌ |
| Price | Free core | Free | $119.99/yr | Free | Varies |

**Moat.** (1) The sign engine: signs written as linguistic parameters, so one
definition drives the teacher, the guide hands, instructions and checking,
with no training data needed per sign. Adding a sign takes minutes, and new
sign languages reuse the engine. (2) Trust: Deaf-led content review and a
privacy stance (hand data never leaves the headset). (3) Distribution through
early-intervention programs, which consumer apps rarely reach. (4) Progress
data (which signs are hard, where) improves hints and the curriculum.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Few families own a headset | Web app plus phone companion; program lending kits; the same engine can drive a phone-camera mode |
| Hand-tracking limits (occlusion, similar handshapes) | Sign set chosen for reliable tracking; specific hints; skip always available; no over-claiming |
| Community trust | Deaf co-leadership and paid review; a practice partner, never a translator; points families to Deaf mentors |
| Headset market softness (IDC: VR headsets fell in 2025) | Web-first, runs on current and upcoming Meta devices, not tied to one store |

## 9. Roadmap

| When | Milestone |
|---|---|
| Nov 2026 | Competition build: 87 signs, coach, pairing, companion site |
| Dec 2026 | Open web beta; recruit Deaf reviewers and three pilot programs |
| Q1 2027 | Meta VR Store listing; Family plan; review of every sign by Deaf signers |
| Q2 2027 | Facial-grammar lessons (taught with video, not scored); two-person practice |
| H2 2027 | Phone-camera mode; BSL and ISL with local Deaf partners |

## 10. Team

**Shivam Gupta**, creator: product, design and engineering.
Looking for: a Deaf co-founder or content lead, advisors from early
intervention and Deaf education, and pilot partners.
