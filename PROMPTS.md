# INTERVIEWOS — AI Development Prompt Log

This document records the AI-assisted prompts used during the development of **INTERVIEWOS** for the ABTalks Vibe Code Hackathon.

The prompts are arranged chronologically: **Day 1** first, followed by **Day 2**.

AI tools used during development included **Antigravity, Claude Sonnet 4.6, Gemini 3.1 Pro, Gemini 3.6 Flash, ChatGPT, and Vercel**. The prompts below preserve the project-related prompts from the development logs provided.

---

# Day 1 — Project Development

## 1. Project Planning & Initial Documentation

**Prompt:**

> i need to make my prototype using data in the attached files only. i need three md files: architecture.md, Project_context.md, coding_rules.md

---

## 2. Planning the AI-Assisted Development Workflow

**Prompt:**

> listen i will use antigravity for generation and u will help me in planning also i have breeth memory api key so can i use it to save context and memory?

---

## 3. Fixing Interview Question Flow

**Prompt:**

> give me a prompt to fix the above

**Context:** The question count was exceeding 8 and the follow-up questions were not matching the candidate's actual answers.

---

## 4. UI Redesign & Dark/Light Mode

**Prompt:**

> i want to change the ui of my current project to the one given in above photos, i also want to add light mode and dark mode option as given in the 5th picture i want all features to be working like normal give me a prompt for this (antigravity)

---

## 5. Implementation Plan

**Prompt:**

> heres the implementation plan

**Context:** An implementation plan for the Interview Agent was attached.

---

## 6. Fixing Core Interview Problems

**Prompt:**

> there are problems with this:
> 1. the question counter is up to 10 we only needed 8
> 2. the question does not change after submitting the response they do change after 3 submissions
> 3. it is using pre defined questions replacing a word or two instead of generic follow up questions
> 4. feedback is not generating even after completion of interview
> 5. evaluation info should not be visible on landing page

---

## 7. Making the Landing Page More Immersive

**Prompt:**

> i want to change the landing page that is interactive, immersive and wows the judges. change the smiley face robot to a 3d looking interactive, moving animation at its place. also its showing 8-10 questions in first image correct it to 8.

---

## 8. Page-Based Navigation & Animation Replacement

**Prompt:**

> i want the website to load new page after clicking start etc not a scrollable like it is right now, replace that smiley face with the html css file i attached and fix the aspect ratio and everything so that it fits the place of smiley face and use it as in place animation and not as a loader replace everywhere in the code i dont want it anywhere

---

## 9. Pushing the Visual Design Further

**Prompt:**

> i do not want this broo listenn see the difference impress me brother

**Context:** Reference screenshots of AFTERMATH and EXHALO were provided to guide the visual direction.

---

## 10. Changing the Interview Question Strategy

**Prompt:**

> i dont want it to pull questions from curriculum.json drop this idea now give me refined prompt

---

## 11. Refining the UI Direction

**Prompt:**

> listen scratch the blend of option a and c instead give prompt only for c

---

## 12. Establishing the Main Visual Language

**Prompt:**

> i want ui to be exactly like the one in the video. change font style as shown in video ui. constraints: i want color scheme to be black blue white only. do not change the typography. u can add text but dont remove existing text. give me a prompt for this.

---

## 13. Animated Background

**Prompt:**

> see keep ui like this i mean the wave is moving in the background match font style as well background should be like this in my color scheme

**Context:** An AgentFlow Dribbble reference was provided.

---

## 14. Homepage/Lobby Improvements & Page Navigation

**Prompt:**

> i want the background of homepage to be same as background of landing page because it looks so plain like it should match that grid and aura kind of thing and also after clicking start interview it scrolls down instead it should open on a new page like every major action on a new page like start interview, begin interview session etc. also improve font of homepage/lobby to look more eye pleasing right now its very basic. make this suitable for gemini 3.6 flash high in antigravity

---

## 15. Replacing the Smiley Animation

**Prompt:**

> replace that smiley face with the html css file i attached and fix the aspect ratio and everything so that it fits the place of smiley face and use it as in place animation and not as a loader replace everywhere in the code i dont want it anywhere make this suitable for gemini 3.6 flash high in antigravity

---

## 16. Feedback Analytics

**Prompt:**

> our current feedback page looks like this i want some graphs like reference image i added i am not saying add exactly the fields that ref image has but my feedback page must have some graphs. make this suitable for gemini 3.6 flash high in antigravity

---

## 17. Feedback Page Polish

**Prompt:**

> this is too basic and empty doesn't describe and is not properly structured, also remove the scroll bar on right, make everything look more polished and eye appealing. make this suitable for gemini 3.6 flash high in antigravity

---

## 18. Feedback, PDF & Theme Fixes

**Prompt:**

> the landing page should not contain any feedback assessment but it does now, also on feedback page theres a lot of empty space at top, on feedback page it does not give full summary the summary is limited by container, also the pdf it generates is incomplete and only 1 page, and light mode does not work properly texts are not visible buttons are not visible etc. make this suitable for gemini 3.6 flash high in antigravity

---

## 19. Same Fixes with Claude Sonnet

**Prompt:**

> the landing page should not contain any feedback assessment but it does now, also on feedback page theres a lot of empty space at top, on feedback page it does not give full summary the summary is limited by container, also the pdf it generates is incomplete and only 1 page, and light mode does not work properly texts are not visible buttons are not visible etc. make this suitable for sonnet 4.6 in antigravity

---

## 20. Feedback Graph & Layout Refinement

**Prompt:**

> the landing page is so messed up and there is still empty space at top in feedback page also the response graph is a little bit stretched

---

## 21. Enforcing the Question Limit

**Prompt:**

> the question limit is 8 but it is exceeding 8 sometimes it goes up to 11 12 do not make any changes except this

---

## 22. Homepage & Lobby Refinement

**Prompt:**

> i want the background of homepage to be same as background of landing page because it looks so plain like it should match that grid and aura kind of thing and also after clicking start interview it scrolls down instead it should open on a new page like every major action on a new page like start interview, begin interview session etc also improve font of homepage/lobby to look more eye pleasing right now its very basic. make this suitable for gemini 3.6 flash high in antigravity

---

## 23. Smiley Animation Replacement with Claude Sonnet

**Prompt:**

> replace that smiley face with the html css file i attached and fix the aspect ratio and everything so that it fits the place of smiley face and use it as in place animation and not as a loader replace everywhere in the code i dont want it anywhere make this suitable for sonnet 4.6 in antigravity

---

## 24. Landing Page Content & Scroll Experience

**Prompt:**

> first one is my current landing page and second and third is the reference and fourth is title bar reference. i want how it works features workflow about these on my landing page, do not change color palette and design of my landing page make it scrollable and it should only page scrollable on my website do not change any other thing except landing page keep font same as original just make it scrollable with proper title bar and workflow features section etc. it has very very smooth animations it is not visible in photos make this suitable for gemini 3.6 flash high in antigravity

---

## 25. Landing Page Content & Scroll Experience with Claude Sonnet

**Prompt:**

> first one is my current landing page and second and third is the reference and fourth is title bar reference. i want how it works features workflow about these on my landing page, do not change color palette and design of my landing page make it scrollable and it should only page scrollable on my website do not change any other thing except landing page keep font same as original just make it scrollable with proper title bar and workflow features section etc. it has very very smooth animations it is not visible in photos make this suitable for sonnet 4.6 in antigravity

---

## 26. Removing Unused Voice UI

**Prompt:**

> this is interview page this page has many voice related buttons and text but we currently dont have any voice feature so i want to remove them i am talking voice active replay and live audio these are currently not in use so remove them and strictly dont change anything else no page changes no color changes no font changes dont change anything except removing these unused buttons make this suitable for gemini 3.6 flash high in antigravity

---

# Day 2 — UI/UX Refinement

## 27. Landing Page Visual Cleanup

**Prompt:**

> this is my project first 3 images are landing page and 4th is codebase, in 2nd image the small boxes above text are empty i want some kind of logo or something to fill in and in 3rd image it does not have a proper border around all text so it looks like its just there alone, give me a prompt for gemini 3.6 flash antigravity to make these changes also strictly do not change anything except these changes i.e no changes in any other page screen text font or color pallete and also make changes while keeping light mode and dark mode both in mind

---

## 28. Typography Improvements

**Prompt:**

> i want font and styling changes in headings and text these looks too basic i want something eye appealing and eye catching, specifically changes in Everything You Need for a Real Interview, How It Works, Built for the ABTalks AI Cohort, What Candidates Say and also the content in how it works and Everything You Need for a Real Interview, strictly do not change anything except these give me a prompt for gemini 3.6 flash antigravity to make these changes

---

## 29. Additional Font Styling

**Prompt:**

> it did not make any major changes so let it import another font styles or styling and dont change anything else

---

## 30. Button Redesign

**Prompt:**

> first image is landing page, 2nd is lobby, 3rd and 4th is interview page and 5th is feedback page, i want to change buttons of these because currently they look very basic i want them eye appealing and they should also match the whole website theme, buttons should have smooth and proper animation and proper and eye appealing font as well download fonts if u want and strictly dont change anything else give me a prompt for gemini 3.6 flash antigravity to make these changes

---

## 31. Applying a Reference Button Design

**Prompt:**

> not very good results i am attaching a button with html and css apply them and match them with color pallete , for all buttons use this button just match color pallete and keep it accordingly, strictly do not change anything else, give me a prompt for gemini 3.6 flash antigravity to make these changes

---

## 32. Lobby Page Visual Refinement

**Prompt:**

> this is lobby page currently it looks too basic as compared to landing page make it attractive and eye appealing without changing any layout structure or anything i.e. the elements should not move or disappear or overlap, apply font and styling changes as well , strictly do not change anything else, give me a prompt for gemini 3.6 flash antigravity to make these changes

---

## 33. Interview Page Visual Refinement

**Prompt:**

> this is interview page make same changes here as done in lobby like font styling background etc strictly do not change anything else, give me a prompt for gemini 3.6 flash antigravity to make these changes

---

## 34. Timer Typography

**Prompt:**

> timer font is not good make it simple not so bold and big strictly do not change anything else, give me a prompt for gemini 3.6 flash antigravity to make these changes

---

## 35. Feedback Page Visual Refinement

**Prompt:**

> 2nd one is my feedback page now make it like landing page like the grid and that bluish aura kind of light and dont do that bold font also improve spacing between cells a bit, strictly do not change anything else, give me a prompt for gemini 3.6 flash antigravity to make these changes

---

## 36. Feedback Grid & Aura Fix

**Prompt:**

> the boxes are slightly overlapping also grid is only upto a specific distance make it show on full page and aura bluish light is missing

---

# AI Tools Used

The development process involved multiple AI-assisted tools and models:

- **Antigravity** — primary AI-assisted development environment
- **Gemini 3.6 Flash** — UI refinement, implementation and debugging prompts
- **Gemini 3.1 Pro** — AI-assisted development
- **Claude Sonnet 4.6** — implementation and refinement
- **ChatGPT** — planning, debugging and development assistance
- **Vercel** — deployment workflow and deployment assistance

This log focuses on prompts directly related to building, debugging, designing, and refining INTERVIEWOS. Administrative conversations such as Git push/pull instructions, repository management, and generating this prompt log itself have been intentionally excluded.
