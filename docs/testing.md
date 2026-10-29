# User testing: no hardware needed

This round tests what anyone can use today: the webcam coach, the demo, the safety check, the dashboard and, optionally, a phone as a stand-in back sensor. The Bluetooth back sensors are hidden (Settings → Back-sensor hardware) until the hardware exists.

## For testers

1. Open https://harshiv2718.github.io/spinesense/ in **Chrome or Edge** on a laptop or desktop with a webcam.
2. Open **Help & feedback** (in the menu, or from the banner on the dashboard). It lists what to try and ticks items off as you go.
3. When you're done, press **Open the feedback form** on that page. It takes about 5 minutes and needs a free GitHub account. If you don't have one, send your notes and the "device details" to whoever invited you.

**Test gently.** Only do exercises that feel comfortable, and stop if pain increases. If pain spreads down a leg, or comes with numbness, weakness, or bladder or bowel changes, stop and see a doctor. SpineSense is an exercise companion, not a medical device.

**Privacy.** Video never leaves your device. Your sessions and answers stay in your browser (Settings → Delete all data removes them). The feedback form is public: describe what the app did, not your health. The "test report" and "device details" you can paste contain tracking numbers, the app version and your browser, never images or anything about pain or discomfort.

## For the person running the test

**What the app enforces for this round** (`TEST_ROUND` in `js/program.js`):

- Before their first camera session, testers read a short information sheet (`js/views/consent.js`). It says who runs the test, that the app is an unvalidated prototype and that taking part is voluntary. It also covers where data goes and how to withdraw. Testers confirm they're 18 or over.
- Anyone whose safety check shows a see-a-doctor sign or a caution is sent to the demo instead of exercising. Self-clearance is switched off, and emergency signs still lock the app.
- Testers without back pain can say so in the safety check rather than inventing answers.
- Feedback goes through a GitHub form that is public. Its privacy checkbox must be ticked, and blank issues are switched off.

**Tasks** (20–30 minutes, any order). The checklist on the Help & feedback page (`js/views/feedback.js`) phrases them as goals, so testers find their own way:

1. Find out whether SpineSense thinks it's OK to exercise today (the safety check).
2. Without the camera, see what a session will be like (the demo).
3. Set up the camera so it can see you for a standing exercise. Note how long it took and how many "step back" prompts appeared.
4. Do two or three standing exercises, only as far as is comfortable.
5. Pretend an exercise hurts: press "I feel pain" and answer it (no real pain needed).
6. Skip an exercise, then finish the session.
7. Find what's suggested for next time, and how today compares.
8. Find out whether video is stored or sent anywhere, then send feedback.

**Recruiting:** run **two rounds of about 5 testers** rather than one big round. Five people find most usability problems, and the second round checks the fixes. Pilot the instructions with one person first. Mix laptops (an older one if you can), lighting and clothing. If you want both people with and without back pain, invite 3–4 of each.

This is a portfolio test, not a clinical study. If you're at a university or want to publish results about people with back pain, check whether you need an ethics review first.

**Message to send** (adults only):

> I'm testing SpineSense, a free webcam exercise coach for back pain that runs in your browser. Could you try it for 20–30 minutes this week? You need to be 18 or over. Open https://harshiv2718.github.io/spinesense/#/feedback in Chrome or Edge on a laptop with a webcam. That page lists what to try and has a short feedback form. Only do exercises that feel comfortable, and if you have more than mild back pain, recent surgery or other warning signs, watch the demo instead. Video never leaves your computer. If you don't have a GitHub account, reply to me with your notes instead. Thanks!

**Collecting results:**

- Each form arrives as a GitHub issue titled "[Test] …", with the build so you know which version a problem was seen on.
- For a tracking problem, ask for the test report. It has the tracking samples and events, but no pain or discomfort data.
- The 1–7 ease score is the Single Ease Question (the average is about 5.5).
- The ten 1–5 statements are the System Usability Scale. Score it as: odd items minus 1, plus 5 minus even items, times 2.5. The average is 68. With 5 testers, report a range, not a single number.
- Clip, phone and data-export files can hold pain answers. Take them only privately, never in an issue.

**After the round:** fix the blockers, bump `VERSION` in `js/version.js`, and run the second round. When the round is over, set `TEST_ROUND` to `false`.
