#  Smart Hand Gesture Presentation Controller

This is a computer vision–based smart presentation controller built using Python, OpenCV, and MediaPipe, enabling users to control presentations using hand gestures instead of traditional input devices.
The system supports slide navigation through swipe gestures in presentation mode, along with real-time cursor (pointer) control inside presentations, allowing users to move and interact with slides hands-free. Additionally, virtual annotation features such as drawing, undo, and clear operations are performed within a separate OpenCV canvas, creating an interactive hybrid experience.

---

##  Core Functionalities

*  Gesture-based presentation navigation

  * Swipe left → Next slide  
  * Swipe right → Previous slide  

*  Virtual annotation system

  * Draw on screen using finger gestures  
  * Pointer mode for highlighting  
  * Undo previous drawings  
  * Clear all annotations  

*  Gesture lock/unlock control

  * Fist gesture used to enable/disable controls

---

##  Features

*  Real-time hand tracking and gesture recognition  
*  Static gesture detection for annotation controls  
*  Dynamic swipe detection for slide navigation  
*  Virtual drawing canvas overlay  
*  Pointer mode for presentation emphasis  
*  Stroke-based undo functionality  
*  Clear-all annotation gesture  
*  Lock/unlock gesture safety mechanism  
*  Gesture debouncing and stabilization logic  
*  Real-time webcam-based interaction  

---

##  Tech Stack

### Computer Vision

* OpenCV  
* MediaPipe  
* NumPy  

### Automation

* PyAutoGUI  

### Language

* Python  

---
## Demo Video
Watch the project demo here:
https://www.dropbox.com/scl/fi/3djpghtsrsc6jzzu9eo72/final-vid.mp4?rlkey=5p366qcw5n5o2473pfrt7y7qj&st=phip5v4y&dl=0

##  Project Structure

```bash
Hand-Gesture-Smart-Presentation-Controller/
│
├── src/
│   ├── finger_utils.py
│   ├── swipe_detector.py
│   └── overlay.py
│
├── main.py
│
└── README.md
```

---

##  Installation & Setup

### 1️ Clone the repository

```bash
git clone https://github.com/yourusername/Hand-Gesture-Smart-Presentation-Controller.git

cd Hand-Gesture-Smart-Presentation-Controller
```

---

### 2 Create virtual environment

```bash
python -m venv venv
```

Activate:

```bash
venv\Scripts\activate
```

---

### 3️ Install dependencies

```bash
pip install opencv-python mediapipe pyautogui numpy
```

---

### 4️ Run the project

```bash
python main.py
```

---

##  Gesture Controls

| Gesture | Action |
|--------|--------|
| ☝️ 1 Finger | Draw |
| ✌️ 2 Fingers | Pointer |
| 🤟 3 Fingers | Undo |
| 🖐️ 4 Fingers | Clear |
| ✊ Fist | Lock / Unlock |
| 👋 Swipe Left | Next Slide |
| 👋 Swipe Right | Previous Slide |

---

##  How It Works

The system uses **MediaPipe hand landmarks** to detect both:

### Static Gestures
Used for:

- Drawing  
- Pointer mode  
- Undo  
- Clear  
- Lock/Unlock  

---

### Dynamic Gestures
Used for:

- Swipe-based slide navigation

The system combines:

- Finger counting logic  
- Gesture stabilization  
- Debounce filtering  
- Swipe motion tracking  
- Stroke history for undo support  

to ensure reliable real-time performance.

---

##  Future Improvements

* PowerPoint native annotation integration  
* Multi-hand gesture support  
* Gesture customization settings  
* Presentation laser mode  
* AI-powered gesture adaptation  

---

## Browser Studio Interface

The repository includes a lightweight HTML, CSS, and JavaScript image/presentation studio. It supports image uploads, multi-image navigation, canvas annotations, image adjustments, PNG export, an optional browser camera preview, and a reference guide to the desktop controller's gestures.

To run the browser interface from the repository root:

```bash
python -m http.server 8000
```

Open `http://localhost:8000` in a browser. The interface does not require additional packages. Camera preview is optional and requires browser permission; gesture detection continues to run in the Python desktop controller.

The browser studio is a separate front end and does not start or connect to the webcam, presentation automation, or gesture-recognition loop in `main.py` by itself.

