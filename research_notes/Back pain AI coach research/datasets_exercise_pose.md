# Public datasets and model approaches for pose-based rehabilitation / back-exercise quality assessment (for SpineSense: MediaPipe Pose, 33 landmarks, single RGB webcam, browser)

Research date: 2026-10-16. "Opened" means the URL was fetched during this research and its content read. "Found" means the URL was found in an authoritative source (the dataset paper, the maintainer's own page, or a search-result listing of the maintainer's page) but could not be fetched (connection refused, 403 or 404). Licences are given only where a page states them. Otherwise the entry says "licence not stated".

---

## Key Question 1: Which public datasets can the SpineSense owner download, and what exactly is in each (access, licence, size, sensors, exercises, labels, MediaPipe fit)?

### Takeaway
Twenty-plus candidates were checked, and 17 have a verified download or request route. Four are the best fit for SpineSense. **KERAAL** has low back pain patients, trunk lateral bend and rotation, error type, body part and timing labels, and it already ships 33-keypoint BlazePose (MediaPipe) skeletons plus RGB. **KIMORE** has low back pain exercises with clinical scores, including RGB video. **REHAB24-6 / REHAB26-ViewAngles** have RGB, rep segmentation and correct/incorrect labels, and REHAB26 ships MediaPipe 33-joint data. **UI-PRMD** has squat, sit-to-stand and shoulder raises. The licence position varies a lot. Several of the most useful sets are non-commercial (REHAB24-6, REHAB26, Fitness-AQA, FLEX) or state no data licence at all (KIMORE, KERAAL data, EHE, TRSP, MM-Fit). Only UI-PRMD (PDDL), IRDS / MEx / VIDIMU / UCOPhyRehab++ (CC BY 4.0) and KINECAL (CC0) are clearly permissive.

### Cited Findings

#### Catalogue table

| # | Dataset (year) | Maintainer | Access URL (status) | Licence / terms | Size | Sensors | Exercises | Labels | Fit to MediaPipe 33-landmark webcam |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **KIMORE**: KInematic assessment of MOvement and clinical scores for remote monitoring of physical REhabilitation (2019) | Capecci et al., VRAI lab, Univ. Politecnica delle Marche | https://vrai.dii.univpm.it/node/204704 (found; server refused connection on 2026-10-16). Segmented-skeleton copy via https://github.com/bruceyo/EGCN (opened) | Licence not stated (page unreachable) | 78 subjects: 44 healthy, 34 patients (stroke, Parkinson's, low back pain) | Kinect v2: RGB, depth, joint positions and orientations | 5: arm lifting, lateral trunk tilt with arms extended, trunk rotation, pelvis rotation on the transverse plane, squatting | Clinical quality score 0–50 (TS); also PO/CF sub-scores per the paper | **Good.** RGB video is included, so MediaPipe can be re-extracted (already done in one paper) |
| 2 | **UI-PRMD**: University of Idaho Physical Rehabilitation Movements Data Set (2018) | Vakanski et al., Univ. of Idaho | Official https://webpages.uidaho.edu/ui-prmd/ now **redirects to a 404** (checked 2026-10-16). Copy in experimental format via https://github.com/bruceyo/EGCN (opened). Processed copy via Rehab-Pile / aeon | ODC PDDL v1.0 (public domain) per the paper | 10 healthy adults × 10 exercises × 10 reps, correct plus deliberately incorrect | Vicon (39 markers, 100 Hz) + Kinect (30 Hz): positions and angles. No RGB | Deep squat, hurdle step, inline lunge, side lunge, sit-to-stand, standing active straight-leg raise, shoulder abduction, shoulder extension, shoulder internal/external rotation, shoulder scaption | Correct vs "incorrect" episodes; pre-segmented into reps | **Medium.** Skeleton only, so a Kinect-25 → MediaPipe-33 joint mapping is needed |
| 3 | **KERAAL**: medical low back pain rehabilitation dataset (data 2017–2019; paper 2024) | Nguyen, Devanne, Remy-Neris, Lempereur, Thépaut (IMT Atlantique / CHU Brest) | https://github.com/nguyensmai/KeraalDataset (opened). Download page http://nguyensmai.free.fr/KeraalDataset.html (fetch failed) | Repo code BSD-2-Clause. **Data licence not stated** | 2,622 recordings. Group 1 LBP patients (1a annotated 249, 1b 1,631). Group 2 healthy (2a 51, 2b 151). Group 3 healthy with simulated errors (540) | Kinect v2 (positions and orientations), RGB video (anonymised, 480×360 / 960×544), OpenPose 2D, **BlazePose 33-keypoint 3D**, Vicon (Group 3) | 3 spine exercises: torso rotation, flank stretch (left/right lateral trunk bend), "hiding face" (arms raised, 90° shoulder/elbow) | Correct/incorrect, error label, significant/small, body part causing the error, per-frame error time window (Anvil XML) | **Best.** Ships MediaPipe-family BlazePose 33 keypoints plus RGB |
| 4 | **IRDS**: IntelliRehabDS (2021) | Miron, Sadawi, Grosan, Ismail, Hussain | https://zenodo.org/records/4610859 (opened) | CC BY 4.0 | 15 patients + 14 healthy; 41.4 GB (skeleton zip 199 MB) | Kinect skeleton + depth images. No RGB | 9 gesture classes (0–8), upper-limb (shoulder/arm) movements; some performed seated or in a wheelchair | Gesture type + correct (1) / incorrect (2), two annotators | **Medium-low.** Skeleton only, upper-limb only |
| 5 | **EHE**: Elderly Home Exercise (2021) | Bruce X.B. Yu et al. (PolyU) | https://github.com/bruceyo/egcnplusplus/tree/main/EHE_dataset (opened; `skeleton.rar`) | Licence not stated | 25 nursing-home residents, 6 exercises (869 reps per a secondary source) | Kinect v2 skeleton | 6 caregiver-led morning exercises (named only by acronym in Rehab-Pile) | Alzheimer's severity 0–10 per subject | **Low.** Skeleton only; label is disease severity, not exercise quality |
| 6 | **REHAB24-6** (2024) | Černek, Sedmidubský, Budíková et al., Masaryk Univ. | https://zenodo.org/records/13305826 (opened) | **CC BY-NC 4.0**, academic/non-profit only; commercial use needs contact with the authors | 10 subjects, 65 recordings, 184,825 frames, 1,072 reps; 5.7 GB | 2 RGB cameras + 16-camera OptiTrack mocap (41 markers); 26-joint 2D/3D | Arm abduction, arm VW, push-ups, leg abduction, leg lunge, squats | Rep start/end frames (1,072), binary correctness, direction, lighting | **Good.** RGB plus mocap ground truth, so MediaPipe can be re-extracted and its error measured |
| 7 | **REHAB26-ViewAngles** (Sept 2026; continues REHAB24-6) | Jánošová, Budíková, Sedmidubský | https://zenodo.org/doi/10.5281/zenodo.23018127 (opened) | **CC BY-NC 4.0** | 5 subjects, 45 long recordings, 1,665 reps (832 correct / 833 incorrect), 29 viewing angles; 9.1 GB | 3 synchronised iPhone 16e RGB cameras (0°/45°/90°); **MediaPipe Pose 33-joint 2D+3D** | Arm abduction, squat, shoulder extension | Rep segmentation, correctness, error type per incorrect rep, person orientation | **Excellent** (native MediaPipe 33 + RGB; studies camera angle) but tiny and non-commercial |
| 8 | **TRSP**: Toronto Rehab Stroke Pose (2017) | Dolatabadi, Taati et al., Toronto Rehab / U of T | https://github.com/derekapricorn/TRSPD (opened). Kaggle https://www.kaggle.com/derekdb/toronto-robot-stroke-posture-dataset (listed on maintainer page) | Licence not stated | 9 stroke survivors + 10 healthy | Kinect v2, 25 joints from depth | Upper-limb exercises on a rehab robot | Per-frame compensation labels (no compensation, lean-forward, shoulder elevation, trunk rotation, per a secondary source) | **Low-medium.** Skeleton only, seated robot task. Trunk-compensation labels are conceptually useful |
| 9 | **UCO Physical Rehabilitation** (2023) | Aguilar-Ortega, Muñoz-Salinas, Marín-Jiménez et al., Univ. of Córdoba | https://github.com/AVAuco/ucophyrehab (opened): **on request** by email to inforeha@uco.es | Licence not stated ("available on request") | 27 healthy adults, 2,160 videos (~1.6 M frames) | 5 RGB cameras 1280×720 + OptiTrack (3 joints per limb) | 8 exercises × L/R: seated knee bend (with/without support), supine straight-leg lift, supine knee bend with bed support, seated shoulder flexion, standing horizontal weighted openings, standing external rotation with band, circular pendulum | 2D/3D GT of 3 joints per limb; 4 slow reps each | **Good for pose-error benchmarking.** RGB multi-view includes supine (lying) positions. Not a quality-label set |
| 10 | **UCOPhyRehab++** (Dec 2025) | Aguilar-Ortega, Zafra-Palma, Muñoz-Salinas, Marín-Jiménez | https://zenodo.org/records/17935737 (opened) | CC BY 4.0, open | 9.7 GB | Silhouettes, optical flow, semantic segmentation, OptiTrack 3D + angles (JSON). Raw RGB not listed as released | Not listed on the record | Not listed on the record | **Low** for MediaPipe (no RGB in the release) |
| 11 | **KINECAL** (2023) | Maudsley-Barton & Yap | https://physionet.org/content/kinecal/1.0.3/ (opened) | **CC0 1.0**, open | 90 participants aged 18–92 (healthy adults, non-fallers, fallers, clinically-at-risk); 180 GB | Kinect v2 depth + 25-joint skeleton, 30 fps. No RGB | 11 balance/mobility tests, incl. **5× sit-to-stand**, TUG, 3 m walk, stances | Falls history, clinical-risk label, 16 sway metrics, demographics | **Medium.** Skeleton only. Useful for sit-to-stand and elderly ROM baselines |
| 12 | **MEx**: Multi-modal Exercise dataset (2019) | Wijekoon, Wiratunga, Cooper (Robert Gordon Univ.) | https://archive.ics.uci.edu/dataset/500/mex (opened); also Mendeley/IEEE DataPort | CC BY 4.0 | 30 subjects (IEEE DataPort says 25); 81.8 MB | 2 wrist/thigh accelerometers, pressure mat, depth camera downscaled to 12×16 | 7 physio exercises, incl. knee-rolling, **bridging**, pelvic tilt, clam, "superman" starting on all fours | Exercise class only | **Very low.** No RGB or skeleton. Only useful for exercise-class priors |
| 13 | **VIDIMU** (2023) | Martínez-Zarzuela et al., Univ. of Valladolid / HES-SO | https://zenodo.org/records/8210563 (opened; v2 exists) | CC BY 4.0 | 54 healthy young adults on video (16 also with IMUs); 42.3 GB | Commodity webcam RGB + 5 IMUs; BodyTrack 3D joints; OpenSim joint angles | 13 daily-life/clinical activities (lower-limb examples incl. sit-to-stand, per paper snippet) | Activity class; IMU-derived joint angles (reference kinematics) | **Good** for webcam domain and ROM reference (RGB plus IMU angles); no quality labels |
| 14 | **Fit3D** (CVPR 2021) | Fieraru, Zanfir, Pirlea, Olaru, Sminchisescu (IMAR) | https://fit3d.imar.ro/ (opened; Download/License pages need login. License page returned 404 to the fetcher) | Licence not stated (could not retrieve) | 11 subjects (8 train, 3 test), 611 sequences, 47 exercises, ~3 M images | 4 RGB views 900×900 @50 fps, mocap, GHUM/SMPL-X fits | 47 exercises in Warmups / Barbell / Dumbbell / Equipment-free categories (names not listed publicly) | Rep time intervals (≥5 reps per sequence), exercise name | **Good** for rep segmentation (RGB plus 3D). Exercise list unverified |
| 15 | **MM-Fit** (2020) | Strömbäck, Huang, Radu | https://mmfit.github.io/ (opened): S3 zip + RGB-D on https://zenodo.org/records/7672767 | Code MIT. **Data licence not stated** | >800 minutes | Orbbec RGB-D, 2D/3D pose estimates, smartphone/smartwatch/earbud IMUs | Squats, push-ups, dumbbell shoulder press, lunges, dumbbell rows, sit-ups, triceps extensions, biceps curls, seated lateral raises, jumping jacks | Exercise class (rep labelling not described on page) | **Medium.** RGB available. Good for recognition and counting of generic exercises |
| 16 | **Fitness-AQA** (ECCV 2022) | Parmar, Gharat, Rhodin (UBC / FlexAI) | https://github.com/ParitoshParmar/Fitness-AQA (opened; Google Form request); https://zenodo.org/records/7310289 | **Non-commercial only** (Zenodo also shows CC BY 4.0, a contradiction) | Count not stated | In-the-wild gym RGB video | Back squat, barbell row, overhead press | Expert-annotated form errors (e.g. knees inward, shallow squat; 7 error types total per a secondary source) | **Good** for error detection from RGB (re-extract MediaPipe) |
| 17 | **QEVD**: Qualcomm Exercise Video Dataset (2024) | Qualcomm AI Research | https://huggingface.co/datasets/Voxel51/qualcomm-exercise-video-dataset-benchmark (opened); full set via https://www.qualcomm.com/developer/software/qevd-dataset | Qualcomm Data Research License (PDF; terms not read) | Fit-300k: 289k clips, 148 exercises. Fit-Coach: 149 workout videos. Benchmark: 74 sessions | RGB video 640×360 @30 fps | Squats, lunges, planks, push-ups, high knees, stretches, etc. | Timestamped coaching feedback (form corrections, counting, transitions) | **Good** for recognition and feedback; RGB, so MediaPipe can be re-extracted |
| 18 | **FLAG3D** (CVPR 2023) | Tang et al. | https://andytang15.github.io/FLAG3D/ (opened) | Signed licence agreement (advisor/org) emailed to the authors | 180K sequences, 60 fitness activities | Mocap, rendered SMPL RGB video, real phone videos | 60 activities across chest, back, waist, hip, leg, etc. (not listed) | Language instructions per activity | **Medium.** Synthetic plus real RGB; useful for synthetic pre-training |
| 19 | **EmoPain** (2016) / EmoPain@Home | Aung, Berthouze et al. (UCL) | https://www.ucl.ac.uk/uclic/research/affective-computing/emopain-dataset (found; 403 to fetcher). Request by email to Prof. Nadia Berthouze ("Dataset request") | Licence not stated (request-based) | 18 CLBP + 22 healthy | Full-body mocap suit, back sEMG, face video, audio | One-leg stand, reach forward, stand-to-sit, **sit-to-stand**, **bend down** (trunk flexion) | Pain level; 6 protective-behaviour types segmented by experts | **Medium.** Mocap skeleton, not RGB body video. Only CLBP movement-behaviour labels |
| 20 | **Rehab-Pile** benchmark archive (2025/2026) | Ismail-Fawaz, Devanne, Berretti, Weber, Forestier | https://msd-irimas.github.io/pages/DeepRehabPile/ (opened); code https://github.com/MSD-IRIMAS/DeepRehabPile; loader `aeon.datasets.load_rehab_pile_dataset` | Licence not stated (inherits source datasets) | 60 tasks (39 classification, 21 regression) from 8 repositories | Pre-processed skeletons from KIMORE, UI-PRMD, IRDS, KERAAL, EHE, KINECAL, SPHERE, UCDHE | As per sources | Standardised folds and labels | **Convenient** benchmark; skeleton-only, Kinect joint sets (18/22/25 joints) |

Datasets checked but **not downloadable** at check time:
- **FineRehab** (CVPRW 2024; 50 participants incl. musculoskeletal patients, 16 actions, 4,215 samples, 2 Kinects + 17 IMUs). Project page says it "will be released soon".
- **IMCD** (2025; 6 isometric poses incl. plank and prone superman). Only a sample is on Google Drive; the full set is to be released after paper acceptance.
- **InfiniteRep** (synthetic). The GitHub repo returned 404.

#### Per-dataset notes (with sources)

**KIMORE**
- Five exercises: (1) arm lifting, (2) lateral trunk tilt with arms extended, (3) trunk rotation, (4) pelvis rotation on the transverse plane, (5) squatting. RGB and depth video plus joint position/orientation from Kinect. 78 participants (44 healthy, 34 with stroke, Parkinson's or LBP). ~353 samples. Clinical quality score 0–50 — [Cross-modal augmentation paper, arXiv 2306.09546](https://arxiv.org/html/2306.09546)
- Paper: Capecci et al., IEEE TNSRE 27:1436–1448, 2019, DOI 10.1109/TNSRE.2019.2923060. The download page advises downloading the CG (Expert/NotExpert) and GPP (BackPain/Parkinson/Stroke) sub-folders separately if the full download fails — [KIMORE dataset page (search listing)](https://vrai.dii.univpm.it/node/204704); the page refused connections when fetched on 2026-10-16.
- Rehab-Pile uses a 71-subject subset (40 healthy / 31 unhealthy), 18 joints × 3D, scores rescaled to 0–100, and a binary split at a score of 50 — [Rehab-Pile dataset JSON](https://msd-irimas.github.io/pages/DeepRehabPile/static/jsons/rehab_datasets.json); [Rehab-Pile paper](https://arxiv.org/html/2507.21018v2)
- The EGCN repo provides segmented KIMORE skeleton data via Google Drive/Baidu — [EGCN GitHub](https://github.com/bruceyo/EGCN)
- No data licence text was retrievable, so the licence is not stated.

**UI-PRMD**
- 10 healthy subjects (mean age 29.3). Vicon (39 markers, 8 cameras, 100 Hz) and Kinect for Xbox One (30 Hz). 10 movements m01–m10 (listed in the table). Incorrect episodes were performed "in a non-optimal manner", not simulating specific injuries, and the paper says they were not yet manually labelled. Full and segmented (per-rep) versions are provided. Format is ASCII .txt (mm, degrees, YXZ Euler). Licence ODC PDDL v1.0 — [Vakanski et al. 2018, Data (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5773117/)
- Official URL https://webpages.uidaho.edu/ui-prmd/ returned HTTP 301 → uidaho.edu/404.htm on 2026-10-16 (fetched directly). Alternative copies: [EGCN GitHub (Google Drive)](https://github.com/bruceyo/EGCN) and the Rehab-Pile processed 22-joint version — [Rehab-Pile JSON](https://msd-irimas.github.io/pages/DeepRehabPile/static/jsons/rehab_datasets.json)

**KERAAL**
- Participants: Group 1 = 12 LBP patients in a rehab programme (wider clinical recruitment of 31 patients aged 18–70). Group 2 = 6 healthy (Kinect). Group 3 = 3 healthy performing correct and simulated erroneous movements (with Vicon). Exercises: torso rotation, flank stretch (left/right lateral bending), "hiding face". Annotation by a physiotherapy doctor and a physiotherapist (Cohen's κ = 0.63 on correct/incorrect). 2,622 recordings (the paper's text and Table II differ by 1 in the patient/healthy split) — [KERAAL paper, arXiv 2407.00521v2](https://arxiv.org/html/2407.00521v2)
- Modalities: Kinect 30 fps text tables, Vicon 60 fps, OpenPose COCO 2D, **BlazePose 33-keypoint 3D at 30 fps**, anonymised videos. Anvil XML annotations with error label, body part, and begin/end timestamps of the error. Repo BSD-2-Clause; no data licence stated — [KERAAL GitHub](https://github.com/nguyensmai/KeraalDataset)
- Rehab-Pile describes KERAAL as 31 LBP patients and uses 11 joints × 7 dims, with 4-class error and binary tasks for the exercises coded ELK/RTK/CTK — [Rehab-Pile](https://arxiv.org/html/2507.21018v2). This conflicts with the paper's 12 annotated patients, probably because of whole-study versus annotated-subset counting.
- Follow-up clinical-trial analysis paper (Jan 2026) — [arXiv 2601.06138](https://arxiv.org/abs/2601.06138v1)

**IRDS (IntelliRehabDS)**
- 15 patients + 14 healthy. Kinect. Gesture labels 0–8. Correctness 1/2 by two annotators. Some participants seated or in a wheelchair. 41.4 GB total. CC BY 4.0. Patient 217's partial data retained — [Zenodo 4610859](https://zenodo.org/records/4610859)
- 2,589 movement files from 29 subjects; shoulder and arm movements — [Frontiers in Medicine 2026 (search result)](https://www.frontiersin.org/journals/medicine/articles/10.3389/fmed.2026.1878438/full)

**EHE**
- Kinect-based recordings of 6 daily caregiver-guided exercises by 25 nursing-home residents, labelled with Alzheimer's severity — [Rehab-Pile](https://arxiv.org/html/2507.21018v2)
- Skeleton files `S##A##L##.skeleton` (subject/action/repetition) in `skeleton.rar`, with generation scripts. No licence stated. Source paper: Yu et al., Pattern Recognition 2021 — [EGCN++ EHE_dataset folder](https://github.com/bruceyo/egcnplusplus/tree/main/EHE_dataset)

**REHAB24-6**
- 65 recordings / 184,825 frames at 30 fps from 10 subjects. 2 RGB + 16 OptiTrack cameras (41 markers, Motive 2.3.0). 26 joints in 2D/3D. Segmentation of 1,072 reps. Binary correctness (~90 per class per exercise; ~50 for push-ups). Lighting and direction labels. CC BY-NC 4.0 (academic/non-profit only). Files: videos 2.7 GB, joints/markers ~3 GB — [Zenodo 13305826](https://zenodo.org/records/13305826)
- The follow-up journal paper shows that fine-tuning pose estimators on the dataset improves their accuracy — [Information Systems 2025](https://www.sciencedirect.com/science/article/abs/pii/S0306437925000638)
- Note: the Zenodo record's version DOI is 13305826 and the concept DOI is 13305825; both resolve to the same dataset — [Zenodo](https://zenodo.org/records/13305826)

**REHAB26-ViewAngles**
- 3 exercises (arm abduction, squat, shoulder extension), 5 participants, 3 iPhones at 0°/45°/90°, 29 unique viewing angles. 1,665 reps (832 correct / 833 incorrect). `Error_types.csv` codes. **MediaPipe Pose 33-joint 2D/3D sequences included**. CC BY-NC 4.0. Linked to arXiv 2609.35726 on patient orientation in single- vs multi-view setups — [Zenodo 10.5281/zenodo.23018127](https://zenodo.org/doi/10.5281/zenodo.23018127)

**Toronto Rehab Stroke Pose (TRSP)**
- Released Sept 2017: 3D pose tracking, per-frame manually labelled compensations, demographics. Kaggle and GitHub links on the maintainer's page. No licence stated — [Babak Taati homepage](https://www.cs.toronto.edu/~taati/index.htm)
- 25 joints from Kinect v2 depth. 9 stroke survivors + 10 healthy. Robot-based task — [TRSPD GitHub](https://github.com/derekapricorn/TRSPD)
- The same page also lists a Parkinson's pose-estimation dataset (CPM trajectories from video, UDysRS/UPDRS/CAPSIT ratings) on Kaggle: https://www.kaggle.com/limi44/parkinsons-visionbased-pose-estimation-dataset — [Taati homepage](https://www.cs.toronto.edu/~taati/index.htm)

**UCO Physical Rehabilitation (2023)**
- Data availability: "Dataset available at https://github.com/AVAuco/ucophyrehab under request". 27 healthy adults (23–60). 5 RGB cams 1280×720. 2,160 videos. OptiTrack GT for 3 joints per evaluated limb — [Sensors 23(21):8862 (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10648737/)
- Request by email (name, affiliation, research purpose) to inforeha@uco.es. No licence stated — [UCO GitHub](https://github.com/AVAuco/ucophyrehab)

**KINECAL**
- 90 participants. Kinect v2 depth + skeleton at 30 fps. 11 tests incl. STS-5 (SPPB), TUG, 3 m walk, stances. Clinical-risk labels, falls history, sway metrics. CC0. 180.1 GB (86.2 GB zip) — [PhysioNet KINECAL 1.0.3](https://physionet.org/content/kinecal/1.0.3/)

**MEx**
- 30 subjects (IEEE DataPort says 25). Axivity AX3 accelerometers (100 Hz), pressure mat 32×16 (15 Hz), Orbbec Astra depth 240×320 downscaled to 12×16 (15 Hz). CC BY 4.0. 81.8 MB — [UCI MEx](https://archive.ics.uci.edu/dataset/500/mex)
- Exercises include knee-rolling (supine, knees bent, roll side to side), bridging (lift hips, hold ~5 s), pelvic tilt, clam, and "superman" starting on all fours. Each was performed for up to 60 s after a demo — [MEx paper arXiv 1908.08992 (search snippet)](https://arxiv.org/pdf/1908.08992)

**VIDIMU**
- 54 healthy young adults on video (16 with IMUs). 13 activities. Low-resolution commodity webcam + 5 custom IMUs. BodyTrack (NVIDIA Maxine) 3D joints. OpenSim IK joint angles. CC BY 4.0. 42.3 GB — [Zenodo 8210563](https://zenodo.org/records/8210563); [arXiv 2303.16150](https://arxiv.org/abs/2303.16150)
- Lower-limb activities include walking variants and sit-to-stand — [arXiv PDF 2303.16150 (search snippet)](https://arxiv.org/pdf/2303.16150). Not confirmed from the full activity list.

**Fit3D**
- 611 multi-view sequences, 2,964,236 3D skeletons, GHUM/SMPL-X fits, >37 exercises "covering all major muscle groups" — [Fit3D home](https://fit3d.imar.ro/)
- 11 subjects (8 train trainees; test = 1 trainer + 2 trainees). 4 views 900×900 @50 fps. 47 exercises in 4 categories. Each recording has rep time intervals. 2,444 video+segmentation pairs — [Fit3D dataset page](https://fit3d.imar.ro/fit3d)

**MM-Fit**
- Main zip on S3 and RGB-D on Zenodo 7672767. Orbbec Astra Pro RGB-D @30 Hz. eSense earbud, 2 TicWatch Pro, 2 phones. 10 exercises (listed in the table). >800 minutes — [MM-Fit site](https://mmfit.github.io/)
- Code MIT; dataset licence not stated — [MM-Fit GitHub](https://github.com/KDMStromback/mm-fit)

**Fitness-AQA**
- Request via Google Form, subject to a licence PDF, non-commercial only. Exercises: BackSquat, OverheadPress, BarbellRow — [Fitness-AQA GitHub](https://github.com/ParitoshParmar/Fitness-AQA)
- Zenodo record lists CC BY 4.0 under Rights but says "Only available for non-commercial purposes" in Notes. Treat it as non-commercial — [Zenodo 7310289](https://zenodo.org/records/7310289)
- In-the-wild gym videos with occlusion, camera angle and clothing variation. Self-supervised pose-contrastive representations beat off-the-shelf 2D/3D pose estimators for error detection — [arXiv 2202.14019](https://arxiv.org/abs/2202.14019)

**QEVD**
- Benchmark: 74 sessions × ~2.5–3 min. 2,511 feedback events (498 transitions, 2,013 feedback). Exercises listed include squats, lunges, planks, push-ups, stretches. Licence: Qualcomm Data Research License (PDF). Full download via Qualcomm page and a download-instructions PDF — [HF dataset card](https://huggingface.co/datasets/Voxel51/qualcomm-exercise-video-dataset-benchmark); [Voxel51 docs](https://docs.voxel51.com/dataset_zoo/datasets_hf/qualcomm_exercise_video_dataset_benchmark.html)
- Fit-300k has 289k clips (2–10 s) of 148 exercises. Fit-Coach has 149 workout videos with coach feedback — [Qualcomm QEVD page (search snippet)](https://developer.qualcomm.com/software/ai-datasets/qevd); paper [arXiv 2407.08101](https://arxiv.org/html/2407.08101v2)

**FLAG3D**
- 180K sequences, 60 categories. Mocap + rendered SMPL videos + real phone videos. Language instructions. Gated by a signed licence agreement; only a 1,800-video rendering subset without extra request — [FLAG3D project](https://andytang15.github.io/FLAG3D/)

**EmoPain / EmoPain@Home**
- 18 CLBP + 22 healthy. Multi-view face video, audio, full-body 3D mocap, back sEMG. Activities: one-leg-stand, reach-forward, stand-to-sit, sit-to-stand, bend-down. Pain-level and 6 protective-behaviour labels — [Aung et al. 2016, UEA eprints](https://ueaeprints.uea.ac.uk/id/eprint/69718/)
- Access by emailing Prof. Nadia Berthouze with subject "Dataset request" (EmoPain@Home: 18 people with and without chronic pain at home) — [UCL EmoPain@Home page (search listing)](https://www.ucl.ac.uk/uclic/research/affective-computing/emopainhome-dataset); [UCL EmoPain page (search listing)](https://www.ucl.ac.uk/uclic/research/affective-computing/emopain-dataset)

**Rehab-Pile (aggregator)**
- 8 repositories → 60 datasets. A bash script and JSON metadata on the project page. Utilities in the DeepRehabPile repo — [project page](https://msd-irimas.github.io/pages/DeepRehabPile/)
- `aeon` loader returns `(n_cases, n_channels, n_timepoints)` arrays with CV folds — [aeon docs](https://www.aeon-toolkit.org/en/stable/api_reference/auto_generated/aeon.datasets.load_rehab_pile_dataset.html)

**Others checked**
- FineRehab: 16 actions, 50 participants (patients with musculoskeletal disorders + healthy), 4,215 samples, 2 Kinects + 17 IMUs; "will be released soon" — [FineRehab project](https://bsu3dvlab.github.io/FineRehab/); [CVPRW 2024 paper](https://openaccess.thecvf.com/content/CVPR2024W/CVsports/html/Li_FineRehab_A_Multi-modality_and_Multi-task_Dataset_for_Rehabilitation_Analysis_CVPRW_2024_paper.html)
- IMCD (Isometric-Multiclass Dataset, 2025): Cobra, Triangle, Warrior-2, Plank (hips too high/low), Tree, Superman (prone). >3,600 clips from mobile phones. Only a sample is released; no licence stated — [arXiv 2506.11774](https://arxiv.org/html/2506.11774)
- FLEX (2025): 20 weight-loaded exercises, 38 subjects, >7,500 multiview recordings with sEMG, fitness knowledge graph of error types and feedback. The arXiv v4 page is CC BY-NC-SA 4.0. No download page verified — [arXiv 2506.03198](https://arxiv.org/html/2506.03198v1); [search listing for v4](https://arxiv.org/html/2506.03198v4)
- EgoExo-Fitness (ECCV 2024): 1,276 ego+exo videos, ~32 h. Access not verified — [arXiv 2406.08877](https://arxiv.org/pdf/2406.08877)
- RepCount (TransRAC, CVPR 2022): Part A videos via mirrors; Part B originals cannot be released. Licence not verified — [TransRAC GitHub (search)](https://github.com/SvipRepetitionCounting/TransRAC)

### Inferences
- **Top picks for SpineSense, in priority order:** (1) KERAAL, which has BlazePose 33 keypoints, LBP patients, lateral bend/rotation and fine error labels. (2) KIMORE, re-extracting MediaPipe from its RGB. (3) REHAB24-6 and REHAB26 for rep segmentation and correctness with RGB/MediaPipe, if non-commercial use is acceptable. (4) UI-PRMD for squat and sit-to-stand, with joint mapping. (5) Fitness-AQA and QEVD for generic exercise recognition and form-error priors from RGB.
- **Commercial-use risk:** if SpineSense is or will be commercial, REHAB24-6, REHAB26, Fitness-AQA, FLEX (NC) and possibly QEVD/FLAG3D (research licences) can only support internal R&D. Before shipping any trained weights, written permission or legal review is needed. Datasets with no stated data licence (KIMORE, KERAAL data, EHE, TRSP, MM-Fit, UCO 2023) should be treated as "all rights reserved, ask the maintainers".
- **Datasets with RGB video:** KIMORE, KERAAL, REHAB24-6, REHAB26, UCO, VIDIMU, Fit3D, MM-Fit, Fitness-AQA, QEVD and FLAG3D (real subset) all ship RGB. Running MediaPipe offline on all of them removes the Kinect→MediaPipe joint-mapping problem.

### Gaps
- KIMORE's licence and current download state could not be verified: the VRAI server refused connections twice.
- KIMORE patient count: a search summary mentioned a KINECAL comparison paper giving 32 patients rather than 34. The primary source for that figure was not opened, so 34 (44 healthy + 34 patients) is used here.
- The UI-PRMD official page is offline (404). It is unclear whether the University of Idaho moved it elsewhere.
- KERAAL's project download page (nguyensmai.free.fr) failed to load, so whether it requires a form or agreement is unverified.
- The Fit3D licence, QEVD licence terms (PDF not read), the full EHE exercise names and the Fitness-AQA sample counts were not verified.
- The InfiniteRep GitHub repo now returns 404, so its availability and licence are unconfirmed.

---

## Key Question 2: Which datasets contain the SpineSense exercises (overhead arm raise, standing side bend, standing hip hinge, sit-to-stand, single knee-to-chest, glute bridge, bird dog) or close equivalents?

### Takeaway
Arm raise, side bend and sit-to-stand are well covered (KIMORE, KERAAL, UI-PRMD, REHAB24-6/26, KINECAL). Squats are abundant. **No downloadable dataset was found with labelled pose data for glute bridge, bird dog, single knee-to-chest or a standing hip hinge.** The only glute bridge and quadruped ("superman on all fours") data is MEx, which has no RGB or skeleton. So these four exercises need SpineSense's own data collection or synthetic generation.

### Cited Findings
- **Overhead arm raise:**
  - KIMORE Ex1 arm lifting — [arXiv 2306.09546](https://arxiv.org/html/2306.09546)
  - UI-PRMD m07 shoulder abduction and m10 scaption — [UI-PRMD paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC5773117/)
  - REHAB24-6 Ex1 arm abduction — [Zenodo](https://zenodo.org/records/13305826)
  - REHAB26 Ex1 arm abduction — [Zenodo](https://zenodo.org/doi/10.5281/zenodo.23018127)
  - UCO seated shoulder flexion — [UCO GitHub](https://github.com/AVAuco/ucophyrehab)
  - KERAAL "hiding face" (arms raised, flexed 90°) is a partial match — [KERAAL paper](https://arxiv.org/html/2407.00521v2)
- **Standing side bend:**
  - KIMORE Ex2 lateral trunk tilt with arms extended — [arXiv 2306.09546](https://arxiv.org/html/2306.09546)
  - KERAAL flank stretch (left/right lateral trunk bending) with error labels — [KERAAL paper](https://arxiv.org/html/2407.00521v2)
- **Trunk rotation (not in SpineSense but related):**
  - KIMORE Ex3 and Ex4 (pelvis rotation) — [arXiv 2306.09546](https://arxiv.org/html/2306.09546)
  - KERAAL torso rotation — [KERAAL paper](https://arxiv.org/html/2407.00521v2)
  - TRSP "trunk rotation" and "lean-forward" compensation labels — [search summary of TRSP paper/PMC5788403](https://pmc.ncbi.nlm.nih.gov/articles/PMC5788403)
- **Standing hip hinge / trunk flexion:**
  - EmoPain "bend-down" (CLBP patients, mocap, request-only) — [EmoPain paper](https://ueaeprints.uea.ac.uk/id/eprint/69718/)
  - Fitness-AQA barbell row (a hinged-torso position, but loaded) — [Fitness-AQA GitHub](https://github.com/ParitoshParmar/Fitness-AQA)
  - No unloaded hip-hinge dataset with quality labels was found.
- **Sit-to-stand:**
  - UI-PRMD m05 — [UI-PRMD paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC5773117/)
  - KINECAL STS-5 — [PhysioNet](https://physionet.org/content/kinecal/1.0.3/)
  - EmoPain sit-to-stand / stand-to-sit — [EmoPain paper](https://ueaeprints.uea.ac.uk/id/eprint/69718/)
  - VIDIMU sit-to-stand (snippet-level evidence) — [arXiv 2303.16150](https://arxiv.org/pdf/2303.16150)
- **Single knee-to-chest:** no dataset found. Closest is UCO's supine "bending the knee with bed support", which is supine hip/knee flexion without hand pull — [UCO GitHub](https://github.com/AVAuco/ucophyrehab)
- **Glute bridge:**
  - MEx "bridging" (accelerometer, pressure mat, 12×16 depth only) — [MEx arXiv 1908.08992](https://arxiv.org/pdf/1908.08992); [UCI](https://archive.ics.uci.edu/dataset/500/mex)
  - A targeted search for a pose-annotated bridge/bird-dog LBP dataset returned only exercise guides and clinical trials — [search result example: 2025 bridge/plank/bird-dog CLBP trial](https://www.researchgate.net/publication/398523203_Effects_of_Bridge_Plank_and_Bird-Dog_Exercises_on_Pain_Disability_and_Transversus_Abdominis_Function_in_Middle-Aged_Women_with_Chronic_Low_Back_Pain_on_Unstable_Surfaces)
- **Bird dog:** MEx "superman" starts "on all 4s", so it is likely the quadruped opposite-arm/leg raise, but the full description was not retrieved — [MEx arXiv 1908.08992 (snippet)](https://arxiv.org/pdf/1908.08992). IMCD's "Superman" is a prone pose, not a bird dog — [arXiv 2506.11774](https://arxiv.org/html/2506.11774)
- **Squats:**
  - KIMORE Ex5 — [arXiv 2306.09546](https://arxiv.org/html/2306.09546)
  - UI-PRMD m01 — [UI-PRMD](https://pmc.ncbi.nlm.nih.gov/articles/PMC5773117/)
  - REHAB24-6 Ex6 — [Zenodo](https://zenodo.org/records/13305826)
  - REHAB26 Ex6 — [Zenodo](https://zenodo.org/doi/10.5281/zenodo.23018127)
  - MM-Fit — [MM-Fit](https://mmfit.github.io/)
  - Fitness-AQA back squat — [GitHub](https://github.com/ParitoshParmar/Fitness-AQA)
  - QEVD — [HF card](https://huggingface.co/datasets/Voxel51/qualcomm-exercise-video-dataset-benchmark)
- **Plank (floor core, related):**
  - IMCD plank with "hips too high / too low" errors (sample only) — [arXiv 2506.11774](https://arxiv.org/html/2506.11774)
  - QEVD planks — [HF card](https://huggingface.co/datasets/Voxel51/qualcomm-exercise-video-dataset-benchmark)

| SpineSense exercise | Best public match (pose/RGB + labels) | Label quality |
|---|---|---|
| Overhead arm raise | KIMORE Ex1; UI-PRMD m07/m10; REHAB24-6/26 Ex1 | Clinical score / correct-incorrect / error type (REHAB26) |
| Standing side bend | KIMORE Ex2; KERAAL flank stretch | Clinical score; error type + body part + timing |
| Standing hip hinge | EmoPain bend-down (request); none open | Protective behaviour only |
| Sit-to-stand | UI-PRMD m05; KINECAL STS-5; EmoPain | Correct/incorrect (UI-PRMD); clinical-risk (KINECAL) |
| Single knee-to-chest | none | none |
| Glute bridge | MEx bridging (no pose) | class only |
| Bird dog | MEx "superman on all 4s" (no pose; equivalence unconfirmed) | class only |

### Inferences
- Five of the seven SpineSense exercises can get a pretrained or validated quality model from public data: arm raise, side bend, sit-to-stand, plus squat and trunk-rotation as auxiliary tasks. The three floor exercises (bridge, bird dog, knee-to-chest) and the hip hinge cannot. Note that MediaPipe on floor exercises is also where the UCO study shows supine positions were hardest for some estimators.
- SpineSense's floor exercises will need (a) self-collected labelled data and (b) the current hand-written angle rules kept as the primary scorer or as weak labels. Evidence that angle rules are competitive is in Key Question 3.

### Gaps
- The exact MEx "superman" description (bird-dog equivalence) was not fully retrieved.
- Fit3D's 47-exercise list and FLAG3D's 60-activity list are not public on their pages. They may include bridges, hinges or bird dogs; checking needs a login/licence.
- QEVD Fit-300k's 148-exercise list was not checked and may include glute bridges or bird dogs.

---

## Key Question 3: What is the state of the art for skeleton-based exercise assessment (GCN, LSTM, transformer, self-supervised), what accuracy is reported on KIMORE / UI-PRMD / KERAAL, and what runs in a browser or on-device?

### Takeaway
On the 2025/2026 Rehab-Pile benchmark (60 tasks), a lightweight depthwise-separable CNN (**LITEMV**) is best overall and cheapest in FLOPs. Transformers (VanTran/ConvTran) are close, and ST-GCN is strong only on KIMORE/UI-PRMD regression. Per-paper KIMORE MAD has fallen from ~0.8–1.5 (Liao 2020, Deb ST-GCN 2022) to ~0.13–0.56 (2026 point-cloud transformer). KERAAL error classification remains hard (LSTM baseline 31–54%). No peer-reviewed browser-native rehab-assessment model was found. However, MediaPipe runs in JS, and the cheapest benchmark models (LITEMV, GRU) are small enough to be plausible TF.js/ONNX-Web candidates.

### Cited Findings
- **Rehab-Pile benchmark (Ismail-Fawaz et al., arXiv 2507.21018, v2 July 2026; IEEE FG 2026):**
  - 9 models: FCN, H-Inception, LITEMV, DisjointCNN, ConvLSTM, MotionGRU, VanTran, ConvTran, STGCN.
  - Classification (39 tasks): LITEMV is best at an average accuracy of 75.49%. VanTran is 1.19 points lower, not significantly different.
  - Regression: LITEMV is best at MAE 5.35 / RMSE 6.43; ConvTran is second.
  - STGCN ranks 6th on regression but wins several KIMORE/UI-PRMD tasks, and is "worst on classification, close to chance". GRU beats LSTM.
  - Accuracy is ~5 points above balanced accuracy, showing class imbalance. The authors say the task is "far from solved" — [Rehab-Pile paper](https://arxiv.org/html/2507.21018v2)
- **Efficiency (Rehab-Pile):** LITEMV has the fewest parameters and FLOPs and "offers the best trade-off between performance and efficiency". MotionGRU has the fastest inference. VanTran is most expensive (quadratic in sequence length, 4 attention layers) — [Rehab-Pile paper, efficiency section](https://arxiv.org/html/2507.21018v2)
- **KIMORE MAD per exercise (Ex1–Ex5), from a 2026 point-cloud transformer paper's comparison table:**
  - Point-cloud + axial-attention transformer: 0.185 / 0.560 / 0.128 / 0.256 / 0.388
  - Mourchid (D-STGCNT): 0.641 / 0.753 / 0.210 / 0.206 / 0.399
  - Deb et al. ST-GCN: 0.799 / 0.774 / 0.369 / 0.347 / 0.621
  - Liao et al.: 1.141 / 1.528 / 0.845 / 0.468 / 0.847
  - The paper claims SOTA "in every experiment", but its own table shows Mourchid better on Ex4 MAD and Ex2/Ex4 MAPE — [arXiv 2606.30309](https://arxiv.org/html/2606.30309)
- **UI-PRMD MAD** (normalised 0–1 scores): ~0.005–0.018 for the 2026 transformer vs 0.006–0.031 for Deb ST-GCN and 0.011–0.042 for Liao — [arXiv 2606.30309](https://arxiv.org/html/2606.30309)
- **Deb et al. 2022 (IEEE TNSRE 30:410–419):** ST-GCN adapted to output continuous scores, handles variable-length input, with self-attention over joints for interpretability (which joint drives the score). Outperformed prior methods on KIMORE and UI-PRMD — [DOAJ record](https://doaj.org/article/f5ac461d723b44f5bfc6202ffc07652f)
- **Other GCN work:**
  - Kourbane et al.'s sequential GCNs claim better score prediction and efficiency (Computers in Biology and Medicine 2025) — [HAL](https://hal.univ-lille.fr/LAB-STICC_RAMBO/hal-04117417v1)
  - EGCN (IJCAI 2022) ensembles position and orientation streams — [EGCN GitHub](https://github.com/bruceyo/EGCN)
  - EHE leaderboard: EGCN 82.41 vs 2T-GCN 80.67 (aggregator figure) — [hyper.ai](https://hyper.ai/ja/sota/tasks/action-assessment/benchmark/action-assessment-on-ehe)
  - Time-warping augmentation with ST-GCN + BiLSTM reports a 21.62% MAD reduction on KIMORE — [KMUTT record](https://kirim.kmutt.ac.th/converis/portal/detail/Publication/1511442206?lang=de_DE)
- **Transformers:**
  - PhysioFormer (ICSR 2024), a SkateFormer-inspired spatio-temporal transformer, reports large gains on KIMORE, UI-PRMD and KERAAL; numbers not retrieved — [IP Paris record](https://researchportal.ip-paris.fr/en/publications/physioformer-a-spatio-temporal-transformer-forphysical-rehabilita/)
  - A 2025 transformer for KERAAL error classification describes KERAAL as the only medical dataset with clear error labels — [arXiv 2504.13866 (search snippet)](https://arxiv.org/pdf/2504.13866)
- **KERAAL baselines (4-class error classification):** GMM+SVM 25–33%. LSTM mean 53.89% (torso rotation), 31.64% (flank stretch), 49.1% (hiding face). Models trained only on correct demos misclassify most incorrect sequences as correct — [KERAAL paper](https://arxiv.org/html/2407.00521v2)
- **Self-supervised / contrastive:**
  - SSL-Rehab (CVIU 2025, masked-skeleton pretraining + LoRA) reports SOTA on KIMORE and UI-PRMD — [HAL](https://hal.ip-paris.fr/LAB-STICC_RAMBO/hal-04841807v1)
  - Hierarchical contrastive representation with positional + angular features and a regression contrastive loss reports >30% MAD reduction on KIMORE and UI-PRMD (IEEE TNSRE 2025) — [DOAJ](https://doaj.org/article/86e143f7254d4ce59232592cf5e88b31)
  - Supervised-contrastive ST-GCN trains one model across all exercises (UI-PRMD, IRDS, KIMORE) — [arXiv 2403.02772](https://arxiv.org/abs/2403.02772v1)
  - Fitness-AQA uses pose-contrastive self-supervision on unlabelled gym video — [arXiv 2202.14019](https://arxiv.org/abs/2202.14019)
- **Augmentation:**
  - Error-Guided Pose Augmentation (EGPA) synthesises clinically plausible mistakes on skeletons, cutting MAE by up to 27.6% and raising error-classification accuracy by 45.8% with an attention GCN — [arXiv 2506.09833](https://arxiv.org/html/2506.09833v1)
  - Video-level augmentation + MediaPipe + LSTM on KIMORE raised Ex1 Spearman correlation from 0.41 to 0.76. It underperformed on Ex4 pelvis rotation because MediaPipe's z-axis is weak — [arXiv 2306.09546](https://arxiv.org/html/2306.09546)
- **Angle rules vs deep models:** on IMCD (6 isometric poses, phone video), a hand-crafted angle-based classifier gave the best weighted F1 on 4 of 6 poses (e.g. plank 0.932) and better reliability than 2s-AGCN. 2s-AGCN won Tree and Superman — [arXiv 2506.11774](https://arxiv.org/html/2506.11774)
- **Rep counting:**
  - PoseRAC uses BlazePose keypoints and represents each action by two salient poses. OBO 0.56 vs 0.29 for TransRAC on RepCount-pose; ~20 min training; ~10× faster inference — [arXiv 2303.08450](https://arxiv.org/pdf/2303.08450)
  - Fit3D, REHAB24-6 and REHAB26 provide rep boundaries for training — [Fit3D](https://fit3d.imar.ro/fit3d); [REHAB24-6](https://zenodo.org/records/13305826)
- **Browser / on-device:**
  - MediaPipe Pose Landmarker outputs 33 3D landmarks (normalised image coordinates plus world landmarks). Lite/Full/Heavy models; Android, iOS, Python and Web/JavaScript — [MediaPipe docs](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker)
  - The UCO study measured MediaPipe at 66.58 FPS on CPU (fastest tested) and recommended it because it "comes ready to be integrated" into Android, iOS and JavaScript — [UCO paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC10648737/)
  - An open-source "My Pose" rehab/fitness app runs BlazePose through TensorFlow.js with real-time feedback (a code project, not a validated model) — [ecosyste.ms listing](https://awesome.ecosyste.ms/projects/github.com%2Fsing1ee%2Fmy-pose)
  - A 2026 ACM paper by the REHAB24-6 group covers real-time monitoring from a smartphone camera stream; full text not accessible (403) — [DOI 10.1145/3805622.3810429](https://doi.org/10.1145/3805622.3810429)
- **Earlier deep baseline:** Liao/Vakanski's deep framework reported MAD 0.03786 on UI-PRMD deep squat — [arXiv 1901.10435 (search snippet)](https://arxiv.org/pdf/1901.10435)

### Inferences
- **Recommended stack for SpineSense:**
  - (a) Exercise recognition: a small temporal CNN/GRU (LITEMV-style or MotionGRU) over normalised MediaPipe world landmarks plus joint angles.
  - (b) Rep segmentation: PoseRAC-style salient-pose classification or a per-frame phase classifier trained on Fit3D/REHAB24-6/REHAB26 rep boundaries.
  - (c) Quality and error detection: a per-exercise regression/classification head. Use contrastive or masked pretraining on unlabelled MediaPipe sequences, and EGPA-style synthetic error augmentation.
  - (d) Personalised ROM: per-user statistics of joint-angle extremes per rep rather than a learned model.
  - All of these are small enough for TF.js or ONNX Runtime Web. That is an inference from Rehab-Pile's FLOPs ranking, not a measured browser benchmark.
- **Keep the angle rules:** the IMCD result and KERAAL's weak deep baselines suggest SpineSense's existing angle rules are a strong baseline. A hybrid works well: rules plus a learned model that uses angle features as inputs.
- **Comparability:** KIMORE metrics are not comparable across papers unless the score scale (0–50 vs 0–100), subject subset (78 vs 71) and cross-validation protocol match. Rehab-Pile is the only standardised protocol.

### Gaps
- Per-dataset Rehab-Pile accuracies (e.g. best KERAAL or KIMORE classification accuracy) appear only in figures not extracted.
- PhysioFormer and SSL-Rehab numbers were not retrieved.
- No peer-reviewed study was found that benchmarks a rehab-assessment model running in-browser via TF.js or ONNX Runtime Web with latency figures.

---

## Key Question 4: What are the practical gaps (Kinect→MediaPipe domain gap, synthetic data, ethical own-data collection)?

### Takeaway
The domain gap is avoidable for datasets with RGB, by re-running MediaPipe offline. For skeleton-only sets (UI-PRMD, IRDS, EHE, KINECAL, TRSP) it means a joint-subset mapping, plus a measurable accuracy penalty, especially in depth (z) and for lying positions. KERAAL is unique in providing Kinect, BlazePose and Vicon for the same sessions, so it can be used to quantify the gap. For the missing floor exercises, the realistic options are (1) consented self-collection with MediaPipe-only storage and (2) skeleton-level synthetic augmentation (EGPA-style) or SMPL-based renders (Fit3D/FLAG3D/InfiniteForm pipelines). Licences for rendered-avatar sources need checking.

### Cited Findings
- **Paired data for the gap:** KERAAL provides Kinect v2, OpenPose, BlazePose (33 keypoints) and Vicon for the same recordings (Vicon for Group 3) — [KERAAL GitHub](https://github.com/nguyensmai/KeraalDataset)
- A 2023 HRI study (Marusic, Nguyen, Tapus) compared Kinect vs OpenPose vs BlazePose with a GMM assessment on the clinical LBP data. The abstract page does not give the result — [IP Paris record](https://researchportal.ip-paris.fr/en/publications/evaluating-kinect-openpose-and-blazepose-for-human-body-movement-/)
- **MediaPipe accuracy vs mocap (UCO):**
  - 3D angle MAE 11.96° ± 9.99° for standing (best of the tested methods for standing).
  - Second for seated and supine (behind HybrIK).
  - Average 2D-angle error 9.36° vs AlphaPose 6.75° — [UCO paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC10648737/)
- **Depth limitation:** MediaPipe struggled with KIMORE pelvis rotation (z-axis), hurting Ex4 scoring — [arXiv 2306.09546](https://arxiv.org/html/2306.09546)
- A stroke study found MediaPipe World Landmarks highly aligned with Kinect — [SMU repository (search snippet)](https://ink.library.smu.edu.sg/sis_research/8506)
- **Camera viewpoint:** REHAB26-ViewAngles was built specifically to study how patient orientation (0–90°) affects MediaPipe-based assessment. It covers 29 angles, with a companion paper on single- vs multi-view setups — [Zenodo](https://zenodo.org/doi/10.5281/zenodo.23018127)
- **Fine-tuning:** fine-tuning pose estimators on REHAB24-6 improves their accuracy on rehab exercises — [Information Systems 2025](https://www.sciencedirect.com/science/article/abs/pii/S0306437925000638)
- **Joint sets differ:** Rehab-Pile skeletons use 18 joints (KIMORE), 22 (UI-PRMD), 25 (IRDS, EHE, KINECAL), 11 joints × 7 dims (KERAAL) and 8 joints in 2D (UCDHE, from OpenPose) — [Rehab-Pile JSON](https://msd-irimas.github.io/pages/DeepRehabPile/static/jsons/rehab_datasets.json)
- **Synthetic options:**
  - Skeleton-level clinically targeted error synthesis (EGPA) — [arXiv 2506.09833](https://arxiv.org/html/2506.09833v1)
  - InfiniteRep: ~1k synthetic avatar exercise videos with frame-level rep counts — [Papers with Code listing (search)](https://cs.paperswithcode.com/dataset/infiniterep). Its GitHub returned 404 on 2026-10-16.
  - InfiniteForm: SMPL-X pose synthesis from a learned pose prior, CC BY 4.0 per search — [arXiv 2110.01330](https://arxiv.org/pdf/2110.01330)
  - FLAG3D: mocap + rendered SMPL videos + real videos, 60 activities, gated licence — [FLAG3D](https://andytang15.github.io/FLAG3D/)
  - Fit3D: GHUM/SMPL-X fits for 47 exercises, usable for retargeting and rendering — [Fit3D](https://fit3d.imar.ro/)
- **Ethics / privacy in collection and release (examples from the field):**
  - KERAAL was collected in a double-blind clinical study with anonymised videos — [KERAAL paper](https://arxiv.org/html/2407.00521v2); [KERAAL GitHub](https://github.com/nguyensmai/KeraalDataset)
  - REHAB24-6 and REHAB26 restrict use to non-commercial research — [Zenodo](https://zenodo.org/records/13305826)
  - EmoPain is shared only on request — [UCL page (search listing)](https://www.ucl.ac.uk/uclic/research/affective-computing/emopainhome-dataset)
  - A UCL video-archiving case study warns that complete anonymity of video cannot be guaranteed — [IJDC (search snippet)](https://ijdc.net/index.php/ijdc/article/download/484/492/2147)
  - Face blurring was a viable pseudonymisation that did not hurt classification in clinical infant video — [DOAJ (search snippet)](https://doaj.org/article/1ac9f20db2774ece9d554ad0977ebf2b)
  - A rehab trial protocol stores the ID-linking list separately from video/sensor data, with logged access — [ClinicalTrials.gov protocol NCT07739134 (search snippet)](https://cdn.clinicaltrials.gov/large-docs/34/NCT07739134/Prot_000.pdf)

### Inferences
- **Practical recipe for the domain gap:**
  - (1) For every RGB dataset, re-extract MediaPipe landmarks offline with the same model variant SpineSense uses in-browser, so train and inference distributions match.
  - (2) Normalise world landmarks by root (hip midpoint) and scale (e.g. torso length). Train on angles plus normalised coordinates, which are more invariant across Kinect and MediaPipe.
  - (3) For skeleton-only sets, map the shared joints (shoulders, elbows, wrists, hips, knees, ankles, plus a spine proxy from the hip/shoulder midpoints) and use them only for pretraining.
  - (4) Use KERAAL's paired Kinect/BlazePose streams to measure the remaining gap.
- **Own data collection:**
  - Get explicit informed consent that covers model training, and an ethics/IRB review if any patients are recruited.
  - Process video in the browser and store only MediaPipe landmarks plus labels. SpineSense already runs MediaPipe client-side, which helps with data minimisation.
  - Have a physiotherapist label reps for correctness and error type using KERAAL's taxonomy (error, body part, time window, significant/small), and measure inter-rater agreement (KERAAL reached κ = 0.63).
  - Collect from several camera angles, following REHAB26.
  - Treat landmarks as pseudonymous health data rather than anonymous: gait/body-shape signatures may still identify people. This is an inference; no source establishes that pose data is anonymous under GDPR.
- **Personalised ROM baselines (goal d):** these need longitudinal per-user data that no public dataset provides. KINECAL (ages 18–92) and VIDIMU (IMU-referenced joint angles) can give population priors and MediaPipe-angle error bounds.

### Gaps
- No source quantified Kinect→MediaPipe model-transfer accuracy (as opposed to joint agreement) on KIMORE/UI-PRMD. The HRI 2023 result numbers were not retrieved.
- The MediaPipe docs page fetched did not state that world landmarks are in metres with a hip-centre origin, so this was not verified here.
- AMASS licensing and any AMASS-derived rehab-exercise synthetic dataset were not verified.
- No source covered the legal status of pose landmarks under GDPR (Art. 9 health data). Legal or DPO review is advised.
