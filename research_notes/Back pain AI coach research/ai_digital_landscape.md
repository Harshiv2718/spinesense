# AI, Computer Vision and Digital Programs for Back Pain: Landscape, Evidence and Gaps (as of Oct 2026)

Scope note for the report writer: these notes cover digital MSK programs, pose-estimation accuracy, AI pain/protective-behaviour detection, LLM coaches, user and clinician criticism, regulation/privacy, and gaps relevant to SpineSense (free browser app, webcam, MediaPipe Pose 33 landmarks + Face Landmarker 52 blendshapes, on-device, rule-based). Company-funded or company-authored evidence is flagged **[COMPANY-FUNDED/AUTHORED]**. Several sources were reached only through search-engine summaries or abstracts (not full text); this is noted where relevant. Many 2026 pose-estimation numbers come from Europe PMC abstracts and are cited by DOI link.

## 1. Digital MSK programs: what they do and what the evidence shows for low back pain

### Takeaway
The best evidence says that therapist-guided digital programs (Hinge Health, Sword Health and similar) get pain and disability results about as good as in-person physiotherapy, not clearly better, and often keep more people engaged in the short term. App-only self-management produces small, sometimes clinically uncertain effects. Most trials and nearly all real-world studies are written or paid for by the companies, and the one independent review (PHTI 2024) relied partly on data the companies supplied.

### Cited Findings

**Independent assessment (PHTI, June 2024)**
- The Peterson Health Technology Institute (PHTI) assessed eight virtual MSK solutions: DarioHealth, Hinge Health, Kaia Health, Limber Health, Omada Health, RecoveryOne, Sword Health and Vori Health. It sorted them into three groups: app-based exercise therapy with limited PT involvement, physical-therapist-guided programs, and remote therapeutic monitoring (RTM) added to in-person PT — [APTA news](https://www.apta.org/news/2024/06/05/phti-report-on-virtual-care); [HC Innovation Group](https://hcinnovationgroup.com/clinical-it/digital-health-innovation/news/55056746/peterson-report-finds-value-in-virtual-musculoskeletal-solutions)
- Category assignment as summarised in secondary coverage: app-based = Dario and Kaia; PT-guided = Hinge, Omada, RecoveryOne, Sword and Vori. Limber's placement (presumably RTM) was not confirmed in the text I retrieved — [HC Innovation Group](https://hcinnovationgroup.com/clinical-it/digital-health-innovation/news/55056746/peterson-report-finds-value-in-virtual-musculoskeletal-solutions); [PHTI Executive Summary PDF](https://phti.org/wp-content/uploads/sites/3/2024/06/PHTI-Virtual-MSK-Solutions-Executive-Summary.pdf)
- Method: a secondary review of published literature **plus proprietary data submitted directly by the companies**. PHTI did no original testing — [PHTI Assessment Report v1.0](https://phti.org/wp-content/uploads/sites/3/2024/06/PHTI-Virtual-MSK-Solutions-Assessment-Report-v1.0.pdf) (summarised via search; the PDF returned 404 when fetched directly in Oct 2026)
- Conclusions:
  - All the solutions gave clinically meaningful improvements in pain and function compared with usual care.
  - PT-guided solutions can be an effective alternative to in-person PT and may reduce spending.
  - RTM-augmented solutions work well clinically but add cost.
  - App-based exercise therapy improves pain compared with no PT, but is "unlikely to be effective as total substitutes" for in-person PT. PHTI did not estimate its budget impact because pricing data were insufficient.
  - Sources: [PHTI Executive Summary](https://phti.org/wp-content/uploads/sites/3/2024/06/PHTI-Virtual-MSK-Solutions-Executive-Summary.pdf); [Healthcare Finance News](https://www.healthcarefinancenews.com/news/virtual-physical-therapy-can-improve-outcomes-spending)
- Adherence: virtual participants completed about one more session per week than in-person patients, and adherence was similar at 12 weeks. These solutions are typically offered as wellness benefits (through employers or health plans), not medical benefits — [PHTI assessment page](https://phti.com/assessment/virtual-msk-solutions/) (search summary; page 404 on direct fetch)
- Cost scenario reported in coverage: if 25% of in-person PT users with low back pain shifted to virtual platforms priced at $995/year, savings would be about $4.4 million per 1 million commercially insured people. The coverage did not say clearly which category this applies to — [Healthcare Finance News](https://www.healthcarefinancenews.com/news/virtual-physical-therapy-can-improve-outcomes-spending)

**Hinge Health** (PT-guided; app exercise therapy + care team; computer vision "TrueMotion")
- 2019 npj Digital Medicine RCT, chronic non-specific LBP, 12-week program (app exercise with wearable sensors, coaching, education). n = 177 analysed (113 treatment, 64 control). Unblinded.
  - VAS pain improved 62% vs 3% in controls; pain impact on daily life improved 64% vs 9%.
  - Modified Von Korff disability improved 55% vs 9%.
  - Interest in surgery fell 52% (it rose 53% in controls).
  - 69 of 91 participants who started exercising completed the program.
  - Sources: [AJMC](https://www.ajmc.com/view/hinge-health-program-significantly-reduced-chronic-back-pain-disability); [MobiHealthNews](https://www.mobihealthnews.com/news/study-hinge-healths-digital-pain-program-reduces-chronic-lower-back-pain-disability)
- **[COMPANY-FUNDED/AUTHORED]** All authors except one (Jeannie F. Bailey, UCSF) were employed by and/or held equity in Hinge Health, as reported in coverage — [MobiHealthNews](https://www.mobihealthnews.com/news/study-hinge-healths-digital-pain-program-reduces-chronic-lower-back-pain-disability)
- Large observational cohort (JMIR, 2020): 10,264 participants, 6,468 with LBP; average pain improvement 68.5% on VAS, as company press materials describe it **[COMPANY-AUTHORED, observational, completers]** — [Hinge Health press release](https://hingehealth.com/resources/press-releases/worlds-largest-digital-msk-study); [Business Wire 2021](https://www.businesswire.com/news/home/20211110005310/en)
- Claims-based study (Journal of Health Economics and Outcomes Research, Nov 2025): 4,330 participants. Hinge users had 60% fewer imaging visits for LBP at 3 months than a traditional-PT comparison group **[COMPANY press release; observational, non-randomised]** — [Business Wire, Nov 2025](https://www.businesswire.com/news/home/20251124002854/en)
- Computer vision: Hinge acquired wrnch (computer-vision motion tracking) in September 2021 — [Hinge Health press release](https://hingehealth.com/resources/press-releases/hinge-health-acquires-the-most-advanced-computer-vision-technology). wrnch was reported to track 87 points on the body — [Wearable Technologies](https://wearable-technologies.com/news/hinge-health-acquires-computer-vision-technology-wrnch-to-boost-its-motion-tracking-capabilities)
- October 2025 launch of two AI tools — [Hinge Health IR](https://ir.hingehealth.com/news/news-details/2025/Hinge-Health-unveils-new-AI-powered-care-tools/default.aspx):
  - "Movement Analysis": uses TrueMotion computer vision to measure joint angles, symmetry and endurance, combined with questions to produce "Hinge Scores".
  - "Robin": a 24/7 AI care assistant that adds to the human care team.
- The Q4 2025 shareholder letter reportedly says members rate Robin 92% positive ("still early"), and that automated AI messaging cut care-team time on asynchronous sessions by 28% **[COMPANY-REPORTED]** — [Yahoo Finance coverage of Q4 2025](https://finance.yahoo.com/news/hinge-health-hnge-q4-2025-230225448.html) (search summary)

**Sword Health** (PT-guided; motion-tracked digital exercise + remote PT; "Phoenix" AI care specialist)
- 2023 npj Digital Medicine RCT (NCT04808141): digital care program vs evidence-based in-person PT for chronic LBP, 70 per arm, 8 weeks, intention-to-treat. Source for all items below: [PMC10329005](https://pmc.ncbi.nlm.nih.gov/articles/PMC10329005/)
  - ODI disability change: digital −6.90 vs in-person −6.35; between-group difference −0.55 (95% CI −2.42 to 5.81), P = 0.412, effect size −0.13.
  - Pain NRS change: −1.81 vs −2.11; difference 0.30, P = 0.666.
  - Dropout: 15.7% vs 34.3% (P = 0.019). Completion: 81.4% vs 64.3%.
  - Mean sessions: 22.3 vs 12.4. Satisfaction: 8.4/10 in both groups.
- **[COMPANY-FUNDED/AUTHORED]** Several authors are Sword Health employees; three hold equity; two independent co-authors received adviser honoraria from Sword. Sword was the study sponsor, even though the paper says "No funding was obtained." It was unblinded, with no objective outcomes and no blinded adjudicator — [PMC10329005](https://pmc.ncbi.nlm.nih.gov/articles/PMC10329005/)
- The design aimed at equivalence. A non-significant difference alone does not prove equivalence, and 70 per arm is small — [Sword clinical studies page](https://swordhealth.com/resources/clinical-studies/digital-care-program-vs-conventional-physiotherapy-lbp) (company page; see PMC for numbers)
- Phoenix ("AI Care Specialist") launched in June 2024 alongside a $130M raise at a $3B valuation. It talks with members in real time during sessions, gives feedback, and summarises performance for the human clinician. Sword says humans stay in the loop — [Sword Health](https://swordhealth.com/articles/introducing-phoenix); [MedCity News](https://medcitynews.com/2024/06/sword-health-financing-ai-musculoskeletal/). Sword cites a 3:1 ROI from a consultancy **[COMPANY claim]** — [Sword AI page](https://refer.swordhealth.com/ai)

**Kaia Health** (app-based; smartphone-camera "Motion Coach"; multidisciplinary pain education/relaxation)
- 2019 npj Digital Medicine RCT (Toelle et al.): n = 101, 3 months of Kaia vs 6 physiotherapy sessions + online education. The authors described results as inconclusive and called for more trials — [PMC6550294](https://pmc.ncbi.nlm.nih.gov/articles/PMC6550294)
- Rise-uP cluster RCT (Journal of Pain Research, 2024): GP-anchored care with the Kaia app vs standard care; n = 1,237 (930 vs 307), ITT completers 511 vs 224. Source for all items below: [PMC11215667](https://pmc.ncbi.nlm.nih.gov/articles/PMC11215667/)
  - NRS pain reduction: −33% vs −14% at 3 months, −39% vs −21% at 6 months, −46% vs −24% at 12 months (all p < 0.001). The adjusted 12-month group difference was p = 0.005.
  - 58% vs 47% achieved more than 33% pain reduction (OR 1.62).
  - Cost (insurer data, difference-in-differences): −€246.95 per patient (reported as 81%, p = 0.021); €416.21 saved per NRS point reduced.
  - 12-month dropout was higher in the app arm: 44% vs 28%.
  - App use fell after 3 months, and **frequency of app use did not correlate with pain reduction** (r = −0.042, p = 0.355).
- Rise-uP funding and COI: funded by the German Innovationsfonds (G-BA, 01NVF16014). Disclosures: J. Priebe received a consultancy fee for analysing Kaia subscriber data; T. Tölle reports fees from many companies, including Kaia Health **[PARTIAL COI; publicly funded trial]** — [PMC11215667](https://pmc.ncbi.nlm.nih.gov/articles/PMC11215667/)
- Motion Coach validation (JMIR 2021, knee/hip osteoarthritis, not LBP): n = 24, 6 exercises. Source for all items below: [PMC8317029](https://pmc.ncbi.nlm.nih.gov/articles/PMC8317029/)
  - App vs physiotherapist κ = 0.551 to 0.626 (percent agreement 0.815 to 0.841).
  - Physiotherapist vs physiotherapist κ = 0.607 (0.833).
  - **[COMPANY-AUTHORED]** Three authors were Kaia employees with salary and stock options; the project was funded by the Bavarian Ministry of Economic Affairs.

**Kemtai** (browser/phone computer-vision home exercise)
- Kemtai says a third-party comparison with a 10-camera Vicon system found an average joint deviation of about 2 cm, and that accuracy was validated in a peer-reviewed study. I could not find the underlying paper, sample size or method **[COMPANY CLAIM, unverified]** — [Kemtai "Our Computer Vision"](https://kemtai.com/our-computer-vision/); [Kemtai FAQ](https://eu.kemtai.com/faqs/)

**Exer (Exer AI / Exer Health)** (camera-based motion assessment for clinicians)
- Camera-only (phone, tablet or laptop) motion analysis with about 144 assessments (ROM, sit-to-stand, gait, balance). Mayo Clinic is deploying it in orthopedic workflows (starting with hand/wrist) with Epic integration — [MobiHealthNews](https://www.mobihealthnews.com/news/exclusive-exer-ai-expands-partnership-mayo-clinic-clinical-deployment). The consumer app is offered "exclusively" to patients of healthcare partners at no cost — [App Store](https://apps.apple.com/app/id1505858367)

**RecoveryOne / Physitrack**
- RecoveryOne was among PHTI's PT-guided solutions — [PR Newswire (RecoveryOne release)](https://prnewswire.com/news-releases/phti-study-confirms-positive-clinical-and-economic-outcomes-for-physical-therapist-guided-virtual-msk-solutions-including-recoveryone-302166493.html?tc=eml_cleartime)
- Physitrack is a clinician-prescribed home-exercise platform (PhysiApp) used alongside in-person PT. It was not among PHTI's eight. See section 5 for qualitative evidence on it — [PLOS Digital Health 2024 (PMC11458024)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11458024/)

**Non-commercial / pooled evidence**
- selfBACK RCT (JAMA Intern Med 2021; AI case-based-reasoning app that tailors self-management): n = 461. RMDQ adjusted mean difference was 0.79 (95% CI 0.06 to 1.51) at 3 months. Authors: improvement "small and of uncertain clinical significance" — [PEDro record](https://search.pedro.org.au/search-results/record-detail/66094)
- 2025 systematic review/meta-analysis of smartphone apps for LBP (15 studies; 2015 to Jan 2025): pooled disability SMD −0.846 (95% CI −2.071 to 0.379, p = 0.176, 3 studies, 925 patients), not significant. Pain was also not significant; only 2 studies were at low risk of bias — [PEDro record 82061](https://search.pedro.org.au/search-results/record-detail/82061)
- 2023 JMIR mHealth meta-analysis, chronic LBP: disability SMD −0.24 (95% CI −0.69 to 0.20) vs usual care, low certainty — [JMIR mHealth](https://mhealth.jmir.org/2023/1/e48204)

### Inferences
- The defensible message from the field is "as good as in-person PT for many people, with better short-term retention," not "better than PT." The superiority-looking numbers (62% pain improvement for Hinge; 46% vs 24% for Kaia) come from unblinded trials against weak controls (usual care or wait-list style) or from company press releases.
- Retention fades. Sword's 8-week dropout advantage (15.7% vs 34.3%) contrasts with Rise-uP's 44% app-arm dropout at 12 months, and with app usage not correlating with pain relief. Long-term engagement is still unsolved.
- The commercial leaders gate access through employers and health plans. Exer is likewise only available through healthcare partners. An ungated, free, no-install tool is structurally different from all of them.
- Human therapist involvement is the variable PHTI rewards. A pure self-guided tool like SpineSense falls in PHTI's "app-based" bucket, where evidence of substitution for PT is weakest. SpineSense should position itself as self-management support or an adjunct, not a PT replacement.

### Gaps
- I could not retrieve the PHTI full report directly (404), so exact category-level spending figures (e.g., per-member savings for PT-guided vs added cost for RTM) are unconfirmed.
- No independent (non-company) RCT of Hinge or Sword for LBP was found.
- Kemtai, Exer and RecoveryOne LBP outcome trials were not found. Kemtai's 2 cm Vicon claim has no traceable paper.
- Hinge's TrueMotion accuracy has no published validation that I could find.
- Kaia's regulatory status (CE class) and any DiGA listing were not verified in this pass.

## 2. Accuracy of webcam/smartphone pose estimation vs motion capture (trunk, spine, hip, rehab exercises)

### Takeaway
Single-camera 2D pose estimation (MediaPipe/BlazePose, MoveNet, OpenPose) is typically within about 2–7° of the reference for large sagittal-plane joints (hip, knee) during slow movements. Errors rise to about 9–13° for multi-joint, lifting or non-sagittal tasks and at end-range angles. Trunk and lumbar measurement from a single consumer camera is barely validated: almost all spine evidence uses multi-camera systems or IMUs. MoveNet does measurably worse than MediaPipe on dynamic tasks.

### Cited Findings

**Single-camera BlazePose / MediaPipe**
- Original BlazePose paper (Google), PCK@0.2: BlazePose Full 84.5 vs OpenPose 83.4 on yoga/fitness, but 84.1 vs 87.8 on the general "in-the-wild" set. It runs 25–75× faster — [arXiv 2006.10204](https://arxiv.org/pdf/2006.10204)
- BlazePose during outdoor running (16 male athletes) vs manual Kinovea measurement (not marker mocap): about 2.1° average error with strong correlations. The hip was the second most accurate joint after the ankle — [reference-global, DOI 10.2478/bhk-2025-0002](https://reference-global.com/article/10.2478/bhk-2025-0002)
- BlazePose vs 2D video (Kinovea), 15 adults (JMIR preprint, not peer-reviewed) — [JMIR Preprints 102399](https://preprints.jmir.org/preprint/102399) (via search summary):
  - Dynamic ICC 0.982 overall, MAE 7.07°, systematic underestimation −5.12°.
  - Squat-specific ICC was only 0.773 [0.23, 0.91].
- MediaPipe vs 3D motion analysis, single-leg jump landing (Heliyon 2024): MediaPipe angles were significantly higher than 3D values, and absolute knee angles showed **no significant concurrent validity** — [DOAJ/Heliyon](https://doaj.org/article/2d283f6411874c82988f54dd2e60829f)
- BlazePose (33 keypoints) vs IMU, seated shoulder abduction 0–62° (Sensors 2026) — [DOI 10.3390/s26165054](https://doi.org/10.3390/s26165054):
  - MAE 2.18°, Lin's CCC 0.956, error about 4% of the measured value.
  - Detecting compensatory movement reached macro-F1 0.75 and 0.72.
- Single smartphone vs IMU, knee during gait (Sensors 2026): flexion MAE 3.15–4.10°, ROM MAE 4.15–4.55°, r 0.845–0.916 — [DOI 10.3390/s26072148](https://doi.org/10.3390/s26072148)
- Multi-model comparison vs 10-camera Vicon (5 male participants; squat, jumps, walking, jogging): during jogging and walking, knee-angle errors from YOLO, MoveNet Lightning and MoveNet Thunder were significantly higher than from MediaPipe and MeTRAbs — [SPONET record, Sci J Sport Perform 2026, DOI 10.55860/XWJL7156](https://sponet.de/sponet/Record/4097725)

**Multi-camera MediaPipe, lifting and clinical populations**
- Multi-view MediaPipe vs gold-standard kinematics (BMC Res Notes 2026) — [DOI 10.1186/s13104-026-07886-4](https://doi.org/10.1186/s13104-026-07886-4):
  - Static postures: ICC 0.851, MAE 9.28°.
  - **Dynamic lifting: ICC 0.823, MAE 12.92°.**
  - Hips/knees/shoulders ICC 0.73–0.92; neck ICC 0.56–0.66; ICC < 0.40 for baselines over 90°.
- Two-camera MediaPipe vs Vicon in degenerative lumbar disease, five-times sit-to-stand (Sensors 2025; 11 healthy, 10 patients): test-retest ICC 0.81–0.99; position RMSE up to 54.55 mm (ankle A-P) and 51.20 mm (hip A-P) — [MDPI Sensors 25(10):3122](https://www.mdpi.com/1424-8220/25/10/3122)

**Trunk / spine specifically**
- MediaPipe + DeepLab segmentation with landmark calibration, Parkinson's posture, vs manually computed angles (not mocap): ICC 0.98 lumbar anterior trunk flexion, 0.96 thoracic, 0.80 lateral trunk flexion — [J Phys Ther Sci 2026, DOI 10.1589/jpts.38.270](https://doi.org/10.1589/jpts.38.270)
- Single-camera MeTRAbs vs Theia3D (IEEE Access 2026): sagittal RMSE 2.10–10.98° across hips, knees and trunk; ROM ICC > 0.93 (mean 0.967) — [DOI 10.1109/access.2026.3687207](https://doi.org/10.1109/access.2026.3687207)
- Markerless motion capture in spine patients vs marker-based (Eur Spine J 2026): ICC > 0.75 for trunk, lumbar, pelvic and lower-limb kinematics; RMSD ≤ 5°; dynamic sagittal vertical axis ICC 0.90. The system was not named in the abstract and is likely multi-camera — [DOI 10.1007/s00586-026-10324-5](https://doi.org/10.1007/s00586-026-10324-5)
- A Chalmers thesis (MediaPipe vs Qualisys on rehab exercises) found trunk-orientation metrics more stable than 2D knee flexion; camera distance and lighting affected the metrics — [Chalmers ODR](https://odr.chalmers.se/bitstreams/6e3607e0-8e8c-4f7f-b33e-c92bfab18210/download)
- No study validated video pose estimation for lumbar ROM in LBP patients. Existing LBP-sample ROM evidence uses smartphone inclinometer apps, not pose estimation — [PeerJ (iPhone app)](https://peerj.com/articles/2355); [Physiotherapy Quarterly (iHandy)](https://physioquart.awf.wroc.pl/Reliability-and-concurrent-validity-of-the-iHandy-level-mobile-application-to-measure,174496,0,2.html)
- Benchmark the webcam must beat — wearable IMU vs Vicon for lumbar flexion inclination: RMSE 1.82° (±1.00°), 95% LoA −3.86° to 4.69° (ViMove; 34 people, 18 with LBP) — [PMC5361703](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5361703/)

**Pooled / review evidence**
- OpenCap (two-smartphone markerless) three-level meta-analysis: pooled RMSE 5.877°, falling to 5.197° after sensitivity analysis and 4.940° after trim-and-fill. Performance varies by task and joint and is worse for high-velocity or complex movements — [Biology of Sport / Termedia](https://www.termedia.pl/Can-OpenCap-deliver-valid-and-reliable-kinematic-data-for-motion-analysis-A-systematic-review-and-three-level-meta-analysis,78,56930,0,0.html)
- Narrative review (Sensors 2026): IMU and vision systems commonly reach RMSE 3–6° for sagittal lower-limb angles in level walking — [DOI 10.3390/s26165063](https://doi.org/10.3390/s26165063)
- Systematic review of markerless motion capture in rehabilitation: clinical application is "still in its preliminary stages," and benefits for assessing patients are inconclusive — [PMC10155325](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10155325/)
- 2023 survey: earlier assessments found markerless pose estimation "mostly inadequate" for correctly assessing rehab exercises, due to poor accuracy and self-occlusion. Newer methods are improving — [arXiv 2308.00519](https://arxiv.org/pdf/2308.00519)
- A low-back-pain rehabilitation dataset comparison of Kinect, OpenPose and BlazePose exists (Marusic et al. 2023), but it used GMM log-likelihood rather than angle error — [IP Paris research portal](https://researchportal.ip-paris.fr/en/publications/evaluating-kinect-openpose-and-blazepose-for-human-body-movement-/)

**Commercial camera form-checking**
- Kaia Motion Coach vs physiotherapists for "correct/incorrect" form: κ 0.55–0.63, similar to physio-physio κ 0.61 **[COMPANY-AUTHORED]** — [PMC8317029](https://pmc.ncbi.nlm.nih.gov/articles/PMC8317029/)

### Inferences
- For SpineSense's rule-based joint-angle thresholds, assume ±5–10° error for hip/knee in a good side-on view, and worse for lifting-type moves, frontal-plane or rotational trunk movements, end-range angles, loose clothing and poor lighting. Thresholds with margins tighter than about 10° will produce false "bad form" cues.
- Relative, within-person measures are more robust than absolute angles: a user's own range dropping versus their own first reps (SpineSense's "range drop" signal), rep counting, and tempo/slowing. Systematic bias, such as the −5° knee underestimate, largely cancels out in these comparisons.
- Single-camera lumbar flexion (as opposed to hip flexion) is essentially unvalidated. MediaPipe has no spine landmarks between the shoulders and hips, so "trunk angle" is a shoulder-hip line that mixes hip and lumbar motion. SpineSense should not claim to measure lumbar or spinal angles.
- MediaPipe is a reasonable choice over MoveNet for this use case, based on the 2026 multi-model Vicon comparison.
- Rep counting and form checking ("correct vs incorrect") are a more realistic target than goniometer-grade angles. Kaia's κ of about 0.6 shows physiotherapists themselves only moderately agree on form.

### Gaps
- No peer-reviewed validation of single-webcam MediaPipe for trunk/lumbar flexion in people with LBP doing typical back exercises (cat-cow, bird-dog, bridges, pelvic tilts, knee-to-chest) against Vicon or IMUs. This is a clear evidence gap SpineSense could help fill.
- The per-joint numbers in the 2026 multi-model Vicon study were not available in the abstract.
- Classic gait comparisons (e.g., OpenPose vs mocap MAEs) were not retrieved in this pass.
- No source found on accuracy for floor-based (supine/quadruped) exercises, where self-occlusion is worst.

## 3. AI that detects pain or protective behaviour from video (face and body)

### Takeaway
Facial pain detection reports very high accuracy inside lab datasets (more than 90%, up to about 99% in-dataset), but performance falls to roughly chance when models move across datasets or into clinical settings. A 2026 MediaPipe Face Mesh model scored F1 of about 0.52 on an unseen dataset. Body-movement protective-behaviour detection for chronic LBP rests almost entirely on one small lab dataset (EmoPain: 22 CLBP participants, full-body mocap + EMG), with moderate accuracy. The only commercial facial pain tool (PainChek) is regulated as a medical device and aimed at people who cannot self-report.

### Cited Findings

**Facial expression (PSPI / action units)**
- UNBC-McMaster has been described as the only publicly available spontaneous pain facial expression dataset: 48,398 FACS-coded frames in 200 sequences from shoulder-pain patients. Automated pain detection in clinical settings was "still far from a reality" — [arXiv 1811.07988 review](https://arxiv.org/pdf/1811.07988)
- 2024 preprints report 98.80% and 99.10% pain-level classification accuracy on UNBC-McMaster (within-dataset, not peer-reviewed) — [Preprints.org 202405.0659](https://www.preprints.org/manuscript/202405.0659)
- **Most relevant to SpineSense** — MediaPipe Face Mesh landmarks → AU features → LSTM/GRU (Sensors 2026) — [DOI 10.3390/s26134136](https://doi.org/10.3390/s26134136):
  - F1 = 0.683 on SynPAIN.
  - Cross-dataset on BioVid Part A (87 subjects, leave-one-subject-out): F1 = 0.519 (LSTM) and 0.499 (GRU).
  - The authors list "recognition accuracy on real-world data" as a limitation.
- ICU patients (Sci Rep 2026, 61 patients): AUs "can fail to transfer to clinical settings accurately" because of disease and facial-texture variation. Six data-derived AUs outperformed the PSPI's predefined AUs — [DOI 10.1038/s41598-026-57148-3](https://doi.org/10.1038/s41598-026-57148-3)
- Scoping review of AI in pain management (47 studies, 2026): detection accuracy "frequently exceeding 85%–90%," but with overfitting risk, few real-world experiments, and small or homogeneous samples — [DOI 10.3389/fpain.2026.1871943](https://doi.org/10.3389/fpain.2026.1871943)
- Pediatric pain AI systematic review (71 studies, 2026; facial analysis in 40.8%): 47.5% of assessment studies had high risk of bias; 42.2% had fewer than 50 participants; multimodal models beat unimodal by +0.13 AUC — [DOI 10.1186/s12911-026-03571-5](https://doi.org/10.1186/s12911-026-03571-5)
- Synthetic pain-face augmentation did not improve classifiers when real data were available. It helped only in data-scarce regimes — [DOI 10.1186/s12938-026-01561-2](https://doi.org/10.1186/s12938-026-01561-2)

**Body movement / protective behaviour (guarding, hesitation)**
- EmoPain dataset: 22 people with chronic LBP and 26 healthy controls; full-body mocap (26 joints) + sEMG from 4 back sites; everyday tasks such as sit-to-stand and reach-forward — [arXiv 1904.10824 (BANet)](https://arxiv.org/pdf/1904.10824)
- EmoPain 2020 challenge: a feature-engineering model beat the LSTM baseline with Matthews correlation 0.43 for pain-level recognition and F-score 61.21 for protective-movement recognition (hold-out validation) — [Univ. of Edinburgh research portal](https://www.research.ed.ac.uk/en/publications/automatic-recognition-of-low-back-chronic-pain-level-and-protecti/)
- L-SFAN (2025) claims state of the art on EmoPain with up to 94% fewer parameters — [UC3M e-Archivo](https://e-archivo.uc3m.es/entities/publication/c457ea86-4bd6-4c57-ac8a-bd5b09f28913)

**Commercial/regulated precedent**
- PainChek analyses 9 facial action units linked to pain and is meant to be used alongside clinician judgement — [Stockhead](https://stockhead.com.au/health/paincheks-ai-app-set-to-transform-pain-detection-beyond-words)
- It submitted for FDA De Novo in November 2024 — [ASX announcement, Nov 2024](https://announcements.asx.com.au/asxpdf/20241120/pdf/06blhghj92l3h6.pdf). A Sept 2026 investor notice lists clearance as a medical device in Australia, Canada, the EU, New Zealand, Singapore, Malaysia, the UK and, via FDA De Novo, the US — [PainChek investor notice, Sept 2026](https://bulletin.webull.com/qbd/announcement/20260903/499501030/7a3d1067b7e46b101b2c27c32e33772c.pdf); [SmallCaps](https://smallcaps.com.au/painchek-secure-fda-de-novo-classification/)
- The FDA authorization covers people who cannot reliably self-report, such as people with dementia — [Simply Wall St](https://simplywall.st/stocks/au/healthcare/asx-pck/painchek-shares/news/should-fda-de-novo-clearance-for-adult-app-prompt-a-rethink/amp)

### Inferences
- A rule-based "grimace score" from MediaPipe blendshapes will be noisy. The closest published system (MediaPipe Face Mesh + learned temporal model) was near chance on unseen faces. SpineSense's design of using facial signals only to trigger a self-reported 0–10 check, not to infer pain, matches what the evidence can support.
- Exercise effort can produce brow-lowering and eye-squeezing that look like PSPI action units. Pain datasets mostly use passive limb movement (UNBC) or induced heat pain (BioVid), not effortful exercise, so false positives from exertion are likely. This is an inference; I found no study that measured it.
- Combining signals (face + range drop + slowing + shaking) is directionally supported: multimodal models beat unimodal ones by +0.13 AUC in pediatric work. Validation for adult LBP exercise is still absent.
- PainChek shows that "detects pain" is treated as a regulated medical-device function in the US, EU, UK and Australia.

### Gaps
- No study found validating facial or body pain detection during home back exercises, on webcams, or in uncontrolled lighting.
- No study found on MediaPipe's 52 ARKit-style blendshapes specifically as PSPI proxies.
- No body-movement guarding detector validated on 2D video (rather than mocap + EMG) for LBP was found.
- Fairness/bias data (skin tone, age, facial differences) for facial pain models were not retrieved in this pass.

## 4. LLMs and AI coaches for back pain education, personalisation and adherence (2023–2026)

### Takeaway
LLM chatbots give mostly guideline-concordant advice on LBP treatment and self-management, but they repeat myths about risk factors, write above lay reading level, and progress exercise too fast when they write programs. Commercial "AI coaches" (Sword Phoenix, Hinge Robin) are deployed with human oversight, and their only outcome data are company metrics. No peer-reviewed RCT of an LLM coach for LBP outcomes or adherence was found. Older AI-tailored apps (selfBACK) show small effects.

### Cited Findings
- Scaff et al. (Ann Rheum Dis 2024): 30 LBP questions put to ChatGPT 3.5, ChatGPT 4, Bing and Bard, and scored against guidelines — [UTS news](https://www.uts.edu.au/news/health-science/ai-chatbots-rival-doctors-accuracy-back-pain-advice-study-finds); [Rheumatology Australia summary](https://www.rheuma.com.au/?p=26776):
  - Best on treatment and self-management; consistently recommended exercise.
  - Most errors on risk factors: chatbots said poor posture causes LBP 88% of the time.
  - They advised seeing a clinician in 70–100% of cases where that was appropriate.
  - Readability was at 10th-grade to university level.
- A 2025 Frontiers in Digital Health review found "substantial variability" in chatbot accuracy compared with MSK clinical practice guidelines — [Frontiers 2025](https://www.frontiersin.org/articles/10.3389/fdgth.2025.1574287/full)
- Expert review of ChatGPT-4.0 programs for case scenarios, including lumbar disc herniation: programs were literature-based but **progressed too quickly** for disc herniation. The authors conclude physical therapists are needed to individualise them — [Bozok University record](https://avesis.bozok.edu.tr/yayin/5614be94-b3ad-4c29-a1c5-0e56de23381a/examining-the-ability-of-artificial-intelligence-with-chatgpt-4-0-to-create-an-exercise-program-case-scenario-examples-lumbar-disc-herniation-chronic-migraine-and-urge-urinary-incontinence)
- AI-HEALS RCT (China, 2025): 3-month AI-supported self-management for non-specific LBP with voice Q&A, reminders and tailored education. I did not retrieve its outcome numbers — [PMC12460242](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12460242/)
- A chatbot-for-adherence trial in lumbar pain (Valencia, NCT06070415, 69 participants) is listed as completed. No results were found — [Veeva CT mirror](https://ctv.veeva.com/study/adherence-to-exercises-for-low-back-pain)
- 2021 Japanese RCT of an automated LINE-messaging exercise chatbot for workers with neck/shoulder or LBP symptoms (12 weeks). The authors noted adherence remains a problem — [PMC8501409](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8501409/)
- A ChatGPT/DeepSeek-generated exercise trial (shoulder, not back; n = 75; PT-supervised) is registered with no results — [ClinicalTrials.gov NCT07148687](https://clinicaltrials.gov/study/NCT07148687)
- Cohort of an AI app-based LBP exercise program vs group exercise: NRS pain −1.4 in the app group vs +0.1 in controls (observational) — [PMC9837473](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9837473/)
- selfBACK (AI-tailored self-management): RMDQ difference 0.79, of uncertain clinical significance — [PEDro](https://search.pedro.org.au/search-results/record-detail/66094)
- Commercial AI coaches:
  - Sword Phoenix (2024): conversational in-session feedback with a human clinician in the loop — [Sword Health](https://swordhealth.com/articles/introducing-phoenix)
  - Hinge Robin (Oct 2025): 92% positive rating and a 28% cut in care-team asynchronous time **[COMPANY-REPORTED]** — [Hinge IR](https://ir.hingehealth.com/news/news-details/2025/Hinge-Health-unveils-new-AI-powered-care-tools/default.aspx); [Yahoo Finance](https://finance.yahoo.com/news/hinge-health-hnge-q4-2025-230225448.html)

### Inferences
- If SpineSense adds an LLM, constrain it to vetted, guideline-based education content. Explicitly correct the "posture causes back pain" myth, since chatbots get this wrong 88% of the time. Keep it out of exercise progression unless rule-based guardrails apply.
- Industry is converging on AI that sits in front of a human. SpineSense has no human, so its safety net must be conservative rules (red-flag screening, stop rules) rather than an AI clinician.

### Gaps
- No peer-reviewed RCT found in which an LLM-based coach improved LBP pain, disability or adherence.
- Outcome numbers for AI-HEALS and the Valencia chatbot trial were not retrieved.
- No independent evaluation of Phoenix or Robin was found.

## 5. What users and physiotherapists criticise

### Takeaway
Recurring complaints are:
- Motion tracking that misreads posture.
- Exercises that do not adapt to how the user feels (sometimes causing discomfort).
- Remote PTs who do not seem to listen.
- Login and registration friction.
- Digital exclusion.
- The program feeling "standalone," disconnected from the rest of care.

Physiotherapists' concerns centre on the loss of hands-on and patient-centred care. Reddit could not be accessed in this research pass.

### Cited Findings
- Hinge Health Trustpilot reviews: complaints that the assigned PT "doesn't listen to or read their issues" or was not attentive to their specific problems — [Trustpilot](https://www.trustpilot.com/review/hingehealth.com?page=3); [Trustpilot UK](https://uk.trustpilot.com/review/hingehealth.com?page=2)
- Aggregated app-review analysis: exercises described as too difficult or not adjusting to user feedback, "leading to discomfort or even injury"; requests for more exercise variety (aggregator summaries; individual reviews not verified) — [Trustpilot IE](https://ie.trustpilot.com/review/hingehealth.com); [Kimola App Store report](https://kimola.com/reports/unlock-insights-into-hinge-healths-rehab-success-app-store-us-154895)
- Tracking complaints: one review says "sometimes the sensors are not correct and can't tell that I am standing up" — [Justuseapp](https://justuseapp.com/en/app/1429270372/hinge-health). Another aggregator lists "motion tracking glitches and connectivity problems" — [Onclarity](https://www.onclarity.com/leaderboard/insight/hingehealth). Justuseapp's "91.5% negative" NLP score conflicts with about 4.9-star store ratings reported elsewhere, so treat aggregator sentiment scores as unreliable — [Millennial Hawk review](https://millennialhawk.com/hinge-health-review/)
- Frequent login issues requiring help each time (AI-generated summary from App Store and Reddit feedback, so a rough signal only) — [Onclarity](https://www.onclarity.com/leaderboard/insight/hingehealth)
- Health-tech commentator Matthew Holt used Sword through his health plan. He found it good as a standalone program, but "the problem was that it was standalone," with no link to other care. He described Hinge and Sword as very similar smartphone self-service exercise models — [The Health Care Blog](https://thehealthcareblog.com/?p=109080)
- A Physitrack comparison page (a competitor) says Hinge's software automates 95% of care delivery — [Physitrack](https://www.physitrack.com/insights/hinge-health-vs-sword-health)
- PLOS Digital Health 2024 (PhysiApp/Physitrack in MSK physiotherapy) — [PMC11458024](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11458024/):
  - Negative impacts on patient-centred care and on practical exercise demonstration.
  - Barriers: suboptimal explanation, digital exclusion, registration/login issues, and the view that the app was "superfluous" to treatment.
  - The patient–physio relationship shaped many of these barriers.
- Qualitative study of LBP patients using Physitrack (JMIR Human Factors 2022, n = 9): acceptance depended on ease of use, perceived benefit and the therapist's instruction — [JMIR Human Factors](https://humanfactors.jmir.org/2022/3/e35316/PDF)
- PT scepticism: industry coverage quotes colleagues at conferences saying "It's not really PT, it's got to be hands on," while others are adopting digital care "cautiously and reluctantly." The quote's attribution is between these two search results — [Net Health dMSK guide](https://www.nethealth.com/dmsk/chapter-2/); [MobiHealthNews](https://mobihealthnews.com/node/149037)
- Evidence that engagement isn't the same as benefit: in Rise-uP, app use frequency did not correlate with pain reduction (r = −0.042), and 12-month dropout was 44% — [PMC11215667](https://pmc.ncbi.nlm.nih.gov/articles/PMC11215667/)

### Inferences
- SpineSense's discomfort-aware easing-off directly addresses the "doesn't adjust when I hurt" complaint. Its no-login, no-install design addresses login and registration friction.
- Tracking misreads are a top complaint even for well-funded products. SpineSense should show the user what the camera sees (skeleton overlay, a confidence indicator) and fail gracefully ("I can't see your hips — step back") rather than giving wrong corrections.
- The lack of human contact cannot be fixed by a free self-guided tool. It can be softened with clear "see a clinician if…" pathways and printable or shareable session summaries for the user's own PT.

### Gaps
- **Reddit (including r/physicaltherapy) was not accessible to the research tools**, so no first-hand Reddit sentiment is included. A manual review is recommended.
- No systematic app-store review study (e.g., a thematic analysis of thousands of reviews) for Hinge, Sword or Kaia was found.
- No data were found on privacy complaints specifically about camera use in these apps.

## 6. Regulatory and privacy: when an app like SpineSense becomes a medical device, and camera health data

### Takeaway
In the US, EU and UK, device status depends on intended purpose and claims, not on the technology. General exercise guidance can stay "wellness." Claims to detect, diagnose, assess or treat a condition, such as "detects pain" or "treats low back pain," push the app toward regulation as software as a medical device; PainChek is the precedent for regulated pain detection. Camera-based inference of discomfort counts as health data under GDPR/UK GDPR even if processed briefly. HIPAA likely does not apply to a free direct-to-consumer app, but the FTC Health Breach Notification Rule does.

### Cited Findings

**United States (FDA)**
- FDA issued an updated General Wellness guidance and revised Clinical Decision Support (CDS) guidance on January 6, 2026, replacing the 2019 and 2022 versions — [Faegre Drinker](https://www.faegredrinker.com/en/insights/publications/2026/1/key-updates-in-fdas-2026-general-wellness-and-clinical-decision-support-software-guidance); [Greenberg Traurig](https://www.gtlaw.com/en/insights/2026/01/fda-updates-two-digital-health-final-guidance-documents)
- Wellness products must be intended only for general wellness and present low risk. Labeling and marketing must match the wellness use. Notes suggesting professional evaluation are allowed only if they avoid naming specific diseases or diagnostic thresholds. Outputs that imply medical use or guide clinical decisions can take a product out of the low-risk category — [Faegre Drinker](https://www.faegredrinker.com/en/insights/publications/2026/1/key-updates-in-fdas-2026-general-wellness-and-clinical-decision-support-software-guidance)
- The framework still recognises both purely wellness claims and disease-referenced claims tied to a healthy lifestyle. Counsel advise avoiding diagnostic framing and thresholds that imply medical management — [AFS Law](https://www.afslaw.com/perspectives/alerts/fda-issues-updated-guidance-low-risk-general-wellness-devices-and-clinical)
- Under the CDS guidance, software that relies on continuous measurements, image analysis or real-time predictions generally remains under FDA oversight — [Faegre Drinker](https://www.faegredrinker.com/en/insights/publications/2026/1/key-updates-in-fdas-2026-general-wellness-and-clinical-decision-support-software-guidance)
- PainChek (facial-AU pain assessment) required FDA De Novo authorization — [SmallCaps](https://smallcaps.com.au/painchek-secure-fda-de-novo-classification/)

**EU (MDR)**
- Intended purpose decides: the same software can be a device or not depending on the manufacturer's claims in labeling, instructions and marketing — [OpenRegulatory MDCG 2019-11 explainer](https://openregulatory.com/mdcg/mdcg-2019-11)
- Fitness tracking, exercise logs and lifestyle advice sit on the wellness side. Diagnostic, monitoring or therapeutic decision-making is medical device software — [Operon Strategist](https://operonstrategist.com/ce-marking-of-digital-health-technologies/)
- MDCG 2019-11 Rev.1 (2025) expands the Rule 11 interpretation and adds borderline wellness/lifestyle examples — [Emergo by UL](https://www.emergobyul.com/news/european-revision-primary-software-guidance-mdcg-2019-11-revision-1-small-changes-meaningful). Rule 11 sub-rules and default classes were not verified against the primary text in this pass.

**UK (MHRA)**
- MHRA guidance (Feb 2025, digital mental health technology): software that diagnoses, prevents or treats conditions using complex software must meet medical device standards. Intended-purpose statements drive classification — [Building Better Healthcare](https://buildingbetterhealthcare.com/mhra-launches-new-guidance-for-digital-tech-aimed); [RegDesk](https://www.regdesk.co/blog/mhra-guidance-on-software-and-ai-as-a-medical-device/)
- MHRA ran the "AI Airlock" regulatory sandbox for AI medical devices — [Taylor Wessing](https://www.taylorwessing.com/de/synapse/2025/ai-in-life-sciences/uk-approach-to-regulating-ai-in-life-sciences)

**Privacy: GDPR / UK GDPR**
- Article 9 GDPR treats data concerning health, and biometric data processed to uniquely identify a person, as special category data requiring an Article 9 condition (e.g., explicit consent) — [GDPR Art. 9 text](https://gdpr-info.eu/art-9-gdpr/)
- ICO: facial images are biometric data only when processed with specific technology that can uniquely identify someone, and they are special category only when used for identification. But if you intend to **infer health information** from biometric data, you may need to treat it as health data. Even briefly creating or collecting data counts as processing — [ICO biometric guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/biometric-data-guidance-biometric-recognition/key-data-protection-concepts/)

**Privacy: US (HIPAA / FTC)**
- The FTC's amended Health Breach Notification Rule (finalised April 26, 2024; effective July 29, 2024) explicitly covers direct-to-consumer health and wellness apps not covered by HIPAA. A "breach" includes unauthorised sharing (e.g., with ad platforms), not just hacks — [Hogan Lovells](https://hoganlovells.com/en/publications/ftc-finalizes-revised-health-breach-notification-rule-expanding-its-scope-and-updating-companies-obligations); [McDermott](https://www.mwe.com/?p=279089)

### Inferences
- "Detects pain" or "measures your pain" is a diagnostic or assessment claim. Combined with the precedent that facial pain assessment needed De Novo, CE and UKCA routes, it would likely make SpineSense a medical device in all three jurisdictions. Safer framing: "notices signs you may be straining and checks in with you," "eases off if you report discomfort," "exercise guidance for general back wellness." Avoid "diagnose," "treat," "detect pain" and disease-specific thresholds. This needs regulatory counsel confirmation.
- Real-time image-analysis outputs that drive the session are the kind of function regulators scrutinise if they are framed as clinical. Keeping outputs to exercise coaching and user self-report is the conservative path.
- On-device MediaPipe processing with no upload is a strong privacy position. Under the ICO's view, inferring discomfort from faces is still processing health data if the controller does it. If any frames, blendshape streams or pain scores leave the device (analytics, crash logs, cloud LLM calls), SpineSense would need explicit consent and Article 9 compliance, plus HBNR-compliant breach handling in the US. Third-party analytics or ad pixels on a page that processes health-inferred data are a known FTC enforcement trigger.
- "No data leaves your device" is both a differentiator and an auditable claim. It should be technically verifiable, for example through open source code or no network calls during sessions.

### Gaps
- It is unresolved whether purely local, browser-side processing that the provider never receives makes the provider a GDPR "controller" of that health data. Legal advice is needed.
- MHRA's specific stance on general wellness exercise apps (outside mental health) was not found in primary gov.uk text.
- The exact MDR Rule 11 class SpineSense would fall into if it made medical claims (likely class IIa under 11(a) for software informing decisions) was not verified against the primary MDCG text.

## 7. Clearest unsolved gaps a free, privacy-first, webcam-only tool could fill

### Takeaway
The market leaders are gated (employer/health plan, or clinician partner), cloud-connected and often sensor-dependent. Their evidence shows parity with PT, not superiority, and fading long-term engagement. The open spaces are:
- Free, ungated access.
- Verifiable on-device privacy.
- Discomfort-responsive dosing grounded in user self-report.
- Honest, published validation of webcam trunk and back-exercise tracking, which does not exist today.

### Cited Findings (evidence underpinning each gap)
- **Access gap:** virtual MSK solutions are typically offered as employer or plan wellness benefits — [PHTI assessment page](https://phti.com/assessment/virtual-msk-solutions/). Exer's patient app is available only through healthcare partners — [App Store](https://apps.apple.com/app/id1505858367)
- **Self-guided evidence gap:** app-only programs show small or non-significant effects on disability — [PEDro 82061](https://search.pedro.org.au/search-results/record-detail/82061); [JMIR mHealth 2023](https://mhealth.jmir.org/2023/1/e48204); [selfBACK](https://search.pedro.org.au/search-results/record-detail/66094)
- **Engagement gap:** 44% dropout at 12 months and no link between usage and pain relief in Rise-uP — [PMC11215667](https://pmc.ncbi.nlm.nih.gov/articles/PMC11215667/)
- **Validation gap:** no single-webcam trunk/lumbar validation in LBP patients; rehab markerless capture is "preliminary" — [PMC10155325](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10155325/); lifting-task MAE of about 12.9° even with multi-view MediaPipe — [DOI 10.1186/s13104-026-07886-4](https://doi.org/10.1186/s13104-026-07886-4)
- **Pain-detection gap:** cross-dataset facial pain F1 of about 0.52 with MediaPipe landmarks — [DOI 10.3390/s26134136](https://doi.org/10.3390/s26134136); protective-behaviour models rest on one 22-patient mocap dataset — [arXiv 1904.10824](https://arxiv.org/pdf/1904.10824)
- **Adaptivity complaint:** users report exercises not adjusting to feedback and causing discomfort — [Trustpilot IE](https://ie.trustpilot.com/review/hingehealth.com)
- **Independence gap:** the flagship RCTs are company-authored, with employees or equity holders as authors — [PMC10329005](https://pmc.ncbi.nlm.nih.gov/articles/PMC10329005/); [MobiHealthNews](https://www.mobihealthnews.com/news/study-hinge-healths-digital-pain-program-reduces-chronic-lower-back-pain-disability)
- **Education accuracy gap:** chatbots repeat the posture myth 88% of the time — [UTS](https://www.uts.edu.au/news/health-science/ai-chatbots-rival-doctors-accuracy-back-pain-advice-study-finds)

### Inferences (opportunities for SpineSense)
1. **Free, no-account, no-install access.** None of the evidence-backed leaders offer this; they are employer- or clinician-gated.
2. **Verifiable on-device privacy.** No video, landmarks or pain scores leave the browser. This avoids GDPR Art. 9 and FTC HBNR exposure and can be marketed truthfully if no third-party trackers are present.
3. **Discomfort-responsive dosing using self-report as ground truth.** Use multi-signal cues (range drop vs the user's own baseline, slowing, shaking, guarding, facial strain) only to prompt a 0–10 check and ease off, never to infer pain. This addresses the "doesn't adapt when it hurts" complaint while staying within wellness claims and within what the evidence supports.
4. **Publish an independent validation.** For example: MediaPipe single-webcam vs IMU or Vicon for the 7 SpineSense exercises, with rep-count accuracy and form-cue agreement vs physiotherapists (Kaia's κ of about 0.6 is the benchmark). This would be among the first open, non-company webcam back-exercise validations.
5. **Open, consented dataset of discomfort during exercise (optional, opt-in).** Pain-AI fields lack real-world, exercise-context data. Even a small, carefully consented dataset (self-reported 0–10 paired with on-device features, not video) would be novel. It would trigger GDPR Article 9 and needs explicit consent.
6. **Robustness UX.** Visibility and confidence checks, camera-placement guidance (side view for sagittal moves), and graceful "can't see you" states, given that tracking misreads are a top complaint for funded apps.
7. **Myth-correcting education** (posture, imaging, "slipped disc" fears) delivered as vetted content rather than open-ended LLM chat. This responds to documented chatbot errors.
8. **Bridge to human care.** Exportable session summaries the user can show their own clinician address the "standalone" criticism without SpineSense becoming a clinical tool.

### Gaps
- No source directly compares whether any commercial product currently performs real-time, pain-adaptive exercise de-escalation from video. The claim that this is unoccupied is an inference from product descriptions, not a confirmed market survey.
- No data were found on uptake of free/open-source back-exercise webcam tools, or on how users trust browser-based camera health apps.
- No cost-effectiveness evidence exists for free self-guided tools. PHTI could not price app-based solutions.
