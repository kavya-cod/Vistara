(() => {
  const canvas = document.querySelector("#editor-canvas");
  const context = canvas.getContext("2d");
  const stage = document.querySelector("#canvas-stage");
  const imageInput = document.querySelector("#image-input");
  const appShell = document.querySelector("#app-shell");
  const slides = [];
  const defaults = { brightness: 100, contrast: 100, saturation: 100 };
  const maxDocumentSlides = 80;
  const maxDocumentBytes = 75 * 1024 * 1024;
  const maxDocumentRenderDimension = 1800;
  const pdfJsCdn = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438";
  let pdfJsPromise;
  const state = {
    activeSlide: 0,
    activeTool: "draw",
    frame: null,
    view: { width: 0, height: 0, ratio: 1 },
    pointer: null,
    keyboardPosition: null,
    activeStroke: null,
    stream: null,
    presenting: false,
    importing: false,
  };

  const elements = {
    imageName: document.querySelector("#active-image-name"),
    slideCount: document.querySelector("#slide-count"),
    slideList: document.querySelector("#slide-list"),
    editorMessage: document.querySelector("#editor-message"),
    canvasStatus: document.querySelector("#canvas-status"),
    canvasEmpty: document.querySelector("#canvas-empty"),
    previousSlide: document.querySelector("#previous-slide"),
    nextSlide: document.querySelector("#next-slide"),
    uploadButton: document.querySelector("#upload-button"),
    emptyUploadButton: document.querySelector("#empty-upload-button"),
    cameraVideo: document.querySelector("#camera-video"),
    cameraFrame: document.querySelector("#camera-frame"),
    cameraStatus: document.querySelector("#camera-status"),
    cameraIndicator: document.querySelector("#camera-indicator"),
    cameraButton: document.querySelector("#camera-button"),
    cameraPlaceholder: document.querySelector("#camera-placeholder"),
  };

  const currentSlide = () => slides[state.activeSlide] || null;
  const setMessage = (message) => { elements.editorMessage.textContent = message; };
  const filterValues = (slide) => slide?.filters || { ...defaults };
  const filterString = (filters) => `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)`;

  function fitImage(image, width, height) {
    const inset = Math.min(42, Math.max(18, Math.min(width, height) * 0.055));
    const availableWidth = Math.max(1, width - inset * 2);
    const availableHeight = Math.max(1, height - inset * 2);
    const scale = Math.min(availableWidth / image.naturalWidth, availableHeight / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    return { x: (width - drawWidth) / 2, y: (height - drawHeight) / 2, width: drawWidth, height: drawHeight, scale };
  }

  function renderCanvas() {
    const { width, height, ratio } = state.view;
    if (!width || !height) return;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#11111d";
    context.fillRect(0, 0, width, height);

    const slide = currentSlide();
    if (!slide || !slide.image.complete || !slide.image.naturalWidth) {
      state.frame = null;
      elements.canvasEmpty.hidden = false;
      return;
    }

    elements.canvasEmpty.hidden = true;
    const frame = fitImage(slide.image, width, height);
    state.frame = frame;
    context.save();
    context.filter = filterString(filterValues(slide));
    context.drawImage(slide.image, frame.x, frame.y, frame.width, frame.height);
    context.restore();

    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const stroke of slide.strokes) {
      if (!stroke.points.length) continue;
      context.beginPath();
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.width * frame.scale;
      context.moveTo(frame.x + stroke.points[0].x * frame.scale, frame.y + stroke.points[0].y * frame.scale);
      for (const point of stroke.points.slice(1)) {
        context.lineTo(frame.x + point.x * frame.scale, frame.y + point.y * frame.scale);
      }
      if (stroke.points.length === 1) {
        context.lineTo(frame.x + stroke.points[0].x * frame.scale + 0.01, frame.y + stroke.points[0].y * frame.scale + 0.01);
      }
      context.stroke();
    }
    context.restore();

    context.save();
    context.strokeStyle = "rgba(236, 231, 255, .27)";
    context.lineWidth = 1;
    context.strokeRect(frame.x + 0.5, frame.y + 0.5, Math.max(0, frame.width - 1), Math.max(0, frame.height - 1));
    if (state.pointer && state.activeTool === "pointer") {
      context.beginPath();
      context.arc(state.pointer.x, state.pointer.y, 10, 0, Math.PI * 2);
      context.fillStyle = "rgba(70, 217, 234, .17)";
      context.fill();
      context.strokeStyle = "#62e6f0";
      context.lineWidth = 2;
      context.stroke();
      context.beginPath();
      context.arc(state.pointer.x, state.pointer.y, 2, 0, Math.PI * 2);
      context.fillStyle = "#efffff";
      context.fill();
    }
    context.restore();
  }

  function updateCanvasSize() {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    if (!bounds.width || !bounds.height) return;
    canvas.width = Math.round(bounds.width * ratio);
    canvas.height = Math.round(bounds.height * ratio);
    state.view = { width: bounds.width, height: bounds.height, ratio };
    renderCanvas();
  }

  function updateSlideControls() {
    const slide = currentSlide();
    const total = slides.length;
    const index = state.activeSlide;
    elements.imageName.textContent = slide?.name || "No image selected";
    elements.slideCount.innerHTML = `${String(total ? index + 1 : 0).padStart(2, "0")} <span>/</span> ${String(total).padStart(2, "0")}`;
    elements.previousSlide.disabled = index <= 0;
    elements.nextSlide.disabled = index >= total - 1;
    elements.canvasStatus.textContent = slide?.isDemo ? "DEMO CANVAS" : "EDITING";
    elements.slideList.replaceChildren();

    slides.forEach((item, itemIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slide-thumb";
      button.setAttribute("role", "listitem");
      button.setAttribute("aria-label", `Open slide ${itemIndex + 1}: ${item.name}`);
      button.setAttribute("aria-current", String(itemIndex === index));
      button.title = item.name;
      const thumbnail = document.createElement("img");
      thumbnail.src = item.source;
      thumbnail.alt = "";
      thumbnail.draggable = false;
      const number = document.createElement("span");
      number.textContent = String(itemIndex + 1).padStart(2, "0");
      button.append(thumbnail, number);
      button.addEventListener("click", () => selectSlide(itemIndex));
      elements.slideList.append(button);
    });
    renderCanvas();
    updateFilterControls();
  }

  function selectSlide(index) {
    if (index < 0 || index >= slides.length || index === state.activeSlide) return;
    state.activeSlide = index;
    state.activeStroke = null;
    state.pointer = null;
    state.keyboardPosition = null;
    updateSlideControls();
    setMessage(`Showing slide ${index + 1} of ${slides.length}. Annotations stay with each slide.`);
  }

  function createImage(source, name, options = {}) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve({
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        source,
        image,
        isDemo: Boolean(options.isDemo),
        strokes: [],
        filters: { ...defaults },
      });
      image.onerror = () => reject(new Error(`The image “${name}” could not be opened.`));
      image.src = source;
    });
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("This document page could not be converted to an image."));
      }, "image/png");
    });
  }

  async function createSlideFromCanvas(sourceCanvas, name) {
    if (!sourceCanvas.width || !sourceCanvas.height) {
      throw new Error("This document page could not be rendered.");
    }
    const flattenedCanvas = document.createElement("canvas");
    flattenedCanvas.width = sourceCanvas.width;
    flattenedCanvas.height = sourceCanvas.height;
    const flattenedContext = flattenedCanvas.getContext("2d", { alpha: false });
    flattenedContext.fillStyle = "#ffffff";
    flattenedContext.fillRect(0, 0, flattenedCanvas.width, flattenedCanvas.height);
    flattenedContext.drawImage(sourceCanvas, 0, 0);
    const source = URL.createObjectURL(await canvasToBlob(flattenedCanvas));
    flattenedCanvas.width = 0;
    flattenedCanvas.height = 0;
    try {
      return await createImage(source, name);
    } catch (error) {
      URL.revokeObjectURL(source);
      throw error;
    }
  }

  async function loadPdfJs() {
    if (!pdfJsPromise) {
      pdfJsPromise = import(`${pdfJsCdn}/build/pdf.mjs`)
        .then((pdfjs) => {
          pdfjs.GlobalWorkerOptions.workerSrc = `${pdfJsCdn}/build/pdf.worker.mjs`;
          return pdfjs;
        })
        .catch(() => {
          pdfJsPromise = null;
          throw new Error("PDF support could not be loaded. Check your internet connection and try again.");
        });
    }
    return pdfJsPromise;
  }

  async function renderPdf(file) {
    const pdfjs = await loadPdfJs();
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      cMapUrl: `${pdfJsCdn}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${pdfJsCdn}/standard_fonts/`,
    });
    const pdfDocument = await loadingTask.promise;
    const pageCount = pdfDocument.numPages;
    const importedSlides = [];
    const renderCanvas = document.createElement("canvas");
    const renderContext = renderCanvas.getContext("2d", { alpha: false });

    try {
      if (pageCount > maxDocumentSlides) {
        throw new Error(`This PDF has ${pageCount} pages. Import up to ${maxDocumentSlides} pages per file.`);
      }
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        setMessage(`Rendering ${file.name} · page ${pageNumber} of ${pageCount}…`);
        const page = await pdfDocument.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, maxDocumentRenderDimension / Math.max(baseViewport.width, baseViewport.height));
        const viewport = page.getViewport({ scale });
        renderCanvas.width = Math.ceil(viewport.width);
        renderCanvas.height = Math.ceil(viewport.height);
        renderContext.fillStyle = "#ffffff";
        renderContext.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
        await page.render({ canvasContext: renderContext, viewport }).promise;
        importedSlides.push(await createSlideFromCanvas(renderCanvas, `${file.name} · page ${pageNumber}`));
        page.cleanup();
        renderCanvas.width = 0;
        renderCanvas.height = 0;
      }
      return importedSlides;
    } catch (error) {
      importedSlides.forEach((slide) => URL.revokeObjectURL(slide.source));
      throw error;
    } finally {
      renderCanvas.width = 0;
      renderCanvas.height = 0;
      await loadingTask.destroy();
    }
  }

  async function renderPowerPoint(file) {
    if (!window.JSZip || !window.PptxViewJS?.PPTXViewer) {
      throw new Error("PowerPoint support could not be loaded. Refresh the page and try again.");
    }
    const renderCanvas = document.createElement("canvas");
    const viewer = new window.PptxViewJS.PPTXViewer({ canvas: renderCanvas });
    const importedSlides = [];

    try {
      await viewer.loadFile(file);
      const slideCount = viewer.getSlideCount();
      if (!slideCount) throw new Error("No slides were found in this PowerPoint file.");
      if (slideCount > maxDocumentSlides) {
        throw new Error(`This presentation has ${slideCount} slides. Import up to ${maxDocumentSlides} slides per file.`);
      }
      for (let slideIndex = 0; slideIndex < slideCount; slideIndex += 1) {
        setMessage(`Rendering ${file.name} · slide ${slideIndex + 1} of ${slideCount}…`);
        if (slideIndex === 0) await viewer.render();
        else await viewer.goToSlide(slideIndex);
        importedSlides.push(await createSlideFromCanvas(renderCanvas, `${file.name} · slide ${slideIndex + 1}`));
      }
      return importedSlides;
    } catch (error) {
      importedSlides.forEach((slide) => URL.revokeObjectURL(slide.source));
      throw error;
    } finally {
      renderCanvas.width = 0;
      renderCanvas.height = 0;
    }
  }

  function getFileKind(file) {
    const name = file.name.toLowerCase();
    if (file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|avif)$/.test(name)) return "image";
    if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
    if (file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || name.endsWith(".pptx")) return "pptx";
    if (name.endsWith(".ppt")) return "legacy-ppt";
    return null;
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length || state.importing) return;
    const issues = [];
    let added = 0;
    state.importing = true;
    imageInput.disabled = true;
    elements.uploadButton.disabled = true;
    elements.emptyUploadButton.disabled = true;

    try {
      for (const file of files) {
        const kind = getFileKind(file);
        if (!kind) {
          issues.push(`${file.name}: unsupported file type.`);
          continue;
        }
        if (kind === "legacy-ppt") {
          issues.push(`${file.name}: save legacy .ppt files as .pptx to import them.`);
          continue;
        }
        if (kind !== "image" && file.size > maxDocumentBytes) {
          issues.push(`${file.name}: documents must be smaller than 75 MB.`);
          continue;
        }

        try {
          let importedSlides;
          if (kind === "image") {
            const source = URL.createObjectURL(file);
            try {
              importedSlides = [await createImage(source, file.name)];
            } catch (error) {
              URL.revokeObjectURL(source);
              throw error;
            }
          } else if (kind === "pdf") {
            importedSlides = await renderPdf(file);
          } else {
            importedSlides = await renderPowerPoint(file);
          }
          slides.push(...importedSlides);
          state.activeSlide = slides.length - 1;
          added += importedSlides.length;
        } catch (error) {
          issues.push(`${file.name}: ${error.message || "could not be imported."}`);
        }
      }

      if (added) {
        state.activeStroke = null;
        state.pointer = null;
        updateSlideControls();
        setMessage(`${added} slide${added === 1 ? "" : "s"} added. You can annotate, adjust, and present them.${issues.length ? ` ${issues.join(" ")}` : ""}`);
      } else if (issues.length) {
        setMessage(issues.join(" "));
      } else {
        setMessage("Choose an image, PDF, or PowerPoint (.pptx) file.");
      }
    } finally {
      state.importing = false;
      imageInput.disabled = false;
      elements.uploadButton.disabled = false;
      elements.emptyUploadButton.disabled = false;
      imageInput.value = "";
    }
  }

  function screenToImage(point) {
    const frame = state.frame;
    const slide = currentSlide();
    if (!frame || !slide || point.x < frame.x || point.y < frame.y || point.x > frame.x + frame.width || point.y > frame.y + frame.height) return null;
    return { x: (point.x - frame.x) / frame.scale, y: (point.y - frame.y) / frame.scale };
  }

  function eventPosition(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function setTool(tool) {
    state.activeTool = tool;
    state.activeStroke = null;
    document.querySelectorAll("[data-tool]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.tool === tool));
    });
    canvas.style.cursor = tool === "draw" ? "crosshair" : "crosshair";
    state.pointer = null;
    setMessage(tool === "draw" ? "Draw on the image to add an annotation." : "Move your pointer over the image to highlight a detail.");
    renderCanvas();
  }

  function undoStroke() {
    const slide = currentSlide();
    if (!slide || !slide.strokes.length) {
      setMessage("There are no annotations to undo on this image.");
      return;
    }
    slide.strokes.pop();
    renderCanvas();
    setMessage("Last annotation removed.");
  }

  function clearStrokes() {
    const slide = currentSlide();
    if (!slide || !slide.strokes.length) {
      setMessage("This image has no annotations to clear.");
      return;
    }
    slide.strokes = [];
    renderCanvas();
    setMessage("Annotations cleared for this image.");
  }

  function updateFilterControls() {
    const filters = filterValues(currentSlide());
    for (const key of Object.keys(defaults)) {
      const input = document.querySelector(`#${key}-slider`);
      const output = document.querySelector(`#${key}-value`);
      input.value = String(filters[key]);
      output.value = `${filters[key]}%`;
      output.textContent = `${filters[key]}%`;
    }
    const preset = identifyPreset(filters);
    document.querySelectorAll("[data-preset]").forEach((button) => {
      const selected = button.dataset.preset === preset;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function identifyPreset(filters) {
    const same = (a, b) => Object.keys(defaults).every((key) => a[key] === b[key]);
    if (same(filters, defaults)) return "original";
    if (same(filters, { brightness: 91, contrast: 112, saturation: 78 })) return "cinema";
    if (same(filters, { brightness: 100, contrast: 112, saturation: 0 })) return "mono";
    return "custom";
  }

  function setPreset(name) {
    const slide = currentSlide();
    if (!slide) return;
    const presets = {
      original: defaults,
      cinema: { brightness: 91, contrast: 112, saturation: 78 },
      mono: { brightness: 100, contrast: 112, saturation: 0 },
    };
    slide.filters = { ...presets[name] };
    updateFilterControls();
    renderCanvas();
    setMessage(`${name === "original" ? "Original" : name === "cinema" ? "Cinema" : "Mono"} look applied.`);
  }

  function exportImage() {
    const slide = currentSlide();
    if (!slide) {
      setMessage("Add a slide before exporting.");
      return;
    }
    const output = document.createElement("canvas");
    output.width = slide.image.naturalWidth;
    output.height = slide.image.naturalHeight;
    const outputContext = output.getContext("2d");
    outputContext.filter = filterString(filterValues(slide));
    outputContext.drawImage(slide.image, 0, 0);
    outputContext.filter = "none";
    outputContext.lineCap = "round";
    outputContext.lineJoin = "round";
    for (const stroke of slide.strokes) {
      if (!stroke.points.length) continue;
      outputContext.beginPath();
      outputContext.strokeStyle = stroke.color;
      outputContext.lineWidth = stroke.width;
      outputContext.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const point of stroke.points.slice(1)) outputContext.lineTo(point.x, point.y);
      if (stroke.points.length === 1) outputContext.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y + 0.01);
      outputContext.stroke();
    }
    output.toBlob((blob) => {
      if (!blob) {
        setMessage("The image could not be exported. Try a different image format.");
        return;
      }
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `${slide.name.replace(/\.[^.]+$/, "")}-edited.png`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("PNG exported at the image’s original resolution.");
    }, "image/png");
  }

  function setPresenting(presenting) {
    state.presenting = presenting;
    appShell.classList.toggle("is-presenting", presenting);
    document.querySelector("#present-button").setAttribute("aria-pressed", String(presenting));
    if (presenting) {
      updateCanvasSize();
      setMessage("Presentation mode. Use the arrow keys to change images, or Escape to exit.");
    } else {
      window.requestAnimationFrame(updateCanvasSize);
      setMessage("Back in the editor.");
    }
  }

  async function toggleCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
      state.stream = null;
      elements.cameraVideo.srcObject = null;
      elements.cameraFrame.classList.remove("is-live");
      elements.cameraStatus.textContent = "Not connected";
      elements.cameraIndicator.classList.remove("is-on");
      elements.cameraIndicator.innerHTML = '<span class="status-dot"></span>OFF';
      elements.cameraButton.textContent = "Enable camera preview";
      setMessage("Camera preview stopped.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      elements.cameraStatus.textContent = "Unavailable in this browser";
      setMessage("Camera preview needs a secure context (HTTPS or localhost) and browser support.");
      return;
    }

    elements.cameraButton.disabled = true;
    elements.cameraButton.textContent = "Waiting for permission…";
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      elements.cameraVideo.srcObject = state.stream;
      await elements.cameraVideo.play();
      elements.cameraFrame.classList.add("is-live");
      elements.cameraStatus.textContent = "Preview active";
      elements.cameraIndicator.classList.add("is-on");
      elements.cameraIndicator.innerHTML = '<span class="status-dot"></span>ON';
      elements.cameraButton.textContent = "Stop camera preview";
      setMessage("Camera preview is active. Gesture recognition still runs in the Python desktop controller.");
    } catch (error) {
      if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
      state.stream = null;
      elements.cameraVideo.srcObject = null;
      elements.cameraStatus.textContent = error.name === "NotAllowedError" ? "Permission denied" : "Could not connect";
      elements.cameraButton.textContent = "Try camera again";
      setMessage(error.name === "NotAllowedError" ? "Camera access was denied. Allow camera access in your browser to preview it." : "Could not start the camera preview. Check that a camera is available and not in use.");
    } finally {
      elements.cameraButton.disabled = false;
    }
  }

  imageInput.addEventListener("change", (event) => addFiles(event.currentTarget.files));
  document.querySelector("#upload-button").addEventListener("click", () => imageInput.click());
  document.querySelector("#empty-upload-button").addEventListener("click", () => imageInput.click());
  document.querySelector("#present-button").addEventListener("click", () => setPresenting(true));
  document.querySelector("#exit-present").addEventListener("click", () => setPresenting(false));
  elements.previousSlide.addEventListener("click", () => selectSlide(state.activeSlide - 1));
  elements.nextSlide.addEventListener("click", () => selectSlide(state.activeSlide + 1));
  document.querySelectorAll("[data-tool]").forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool)));
  document.querySelector("#undo-button").addEventListener("click", undoStroke);
  document.querySelector("#clear-button").addEventListener("click", clearStrokes);
  document.querySelector("#export-button").addEventListener("click", exportImage);
  document.querySelector("#reset-filters").addEventListener("click", () => setPreset("original"));
  document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => setPreset(button.dataset.preset)));
  elements.cameraButton.addEventListener("click", toggleCamera);

  for (const key of Object.keys(defaults)) {
    document.querySelector(`#${key}-slider`).addEventListener("input", (event) => {
      const slide = currentSlide();
      if (!slide) return;
      slide.filters[key] = Number(event.currentTarget.value);
      updateFilterControls();
      renderCanvas();
      setMessage("Image settings updated. Export to save the edited image.");
    });
  }

  canvas.addEventListener("pointerdown", (event) => {
    const position = eventPosition(event);
    state.keyboardPosition = position;
    const imagePoint = screenToImage(position);
    if (!imagePoint) return;
    if (state.activeTool === "pointer") {
      state.pointer = position;
      renderCanvas();
      return;
    }
    const slide = currentSlide();
    if (!slide) return;
    canvas.setPointerCapture(event.pointerId);
    const scale = state.frame?.scale || 1;
    state.activeStroke = { color: "#42e6dd", width: 4 / scale, points: [imagePoint] };
    slide.strokes.push(state.activeStroke);
    renderCanvas();
  });

  canvas.addEventListener("pointermove", (event) => {
    const position = eventPosition(event);
    if (state.activeTool === "pointer") {
      state.pointer = screenToImage(position) ? position : null;
      renderCanvas();
      return;
    }
    if (!state.activeStroke) return;
    const imagePoint = screenToImage(position);
    if (!imagePoint) return;
    state.activeStroke.points.push(imagePoint);
    renderCanvas();
  });
  canvas.addEventListener("pointerup", () => { state.activeStroke = null; });
  canvas.addEventListener("pointercancel", () => { state.activeStroke = null; });
  canvas.addEventListener("pointerleave", () => {
    if (state.activeTool === "pointer") {
      state.pointer = null;
      renderCanvas();
    }
  });
  canvas.addEventListener("keydown", (event) => {
    const frame = state.frame;
    if (!frame) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const step = event.shiftKey ? 28 : 10;
      const position = state.keyboardPosition || { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
      if (event.key === "ArrowLeft") position.x -= step;
      if (event.key === "ArrowRight") position.x += step;
      if (event.key === "ArrowUp") position.y -= step;
      if (event.key === "ArrowDown") position.y += step;
      position.x = Math.min(frame.x + frame.width, Math.max(frame.x, position.x));
      position.y = Math.min(frame.y + frame.height, Math.max(frame.y, position.y));
      state.keyboardPosition = position;
      state.pointer = state.activeTool === "pointer" ? position : null;
      renderCanvas();
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    const imagePoint = screenToImage(state.keyboardPosition || { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 });
    if (!imagePoint) return;
    if (state.activeTool === "pointer") {
      state.pointer = state.keyboardPosition || { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
      setMessage("Pointer placed on the canvas.");
    } else {
      currentSlide().strokes.push({ color: "#42e6dd", width: 4 / frame.scale, points: [imagePoint] });
      setMessage("Annotation added at the keyboard cursor.");
    }
    renderCanvas();
  });

  ["dragenter", "dragover"].forEach((eventName) => stage.addEventListener(eventName, (event) => {
    event.preventDefault();
    stage.classList.add("drag-over");
  }));
  ["dragleave", "drop"].forEach((eventName) => stage.addEventListener(eventName, (event) => {
    event.preventDefault();
    stage.classList.remove("drag-over");
  }));
  stage.addEventListener("drop", (event) => addFiles(event.dataTransfer?.files));

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    const editingField = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    if (editingField) return;
    if (event.key === "Escape" && state.presenting) setPresenting(false);
    if (target !== canvas && event.key === "ArrowLeft") selectSlide(state.activeSlide - 1);
    if (target !== canvas && event.key === "ArrowRight") selectSlide(state.activeSlide + 1);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undoStroke();
    }
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(updateCanvasSize).observe(stage);
  } else {
    window.addEventListener("resize", updateCanvasSize);
  }
  window.addEventListener("beforeunload", () => state.stream?.getTracks().forEach((track) => track.stop()));

  async function loadDemo() {
    try {
      const demo = await createImage("./assets/studio-sample.png", "Pacific coast — demo image", { isDemo: true });
      slides.push(demo);
      updateSlideControls();
      updateCanvasSize();
    } catch {
      elements.canvasEmpty.hidden = false;
      elements.canvasStatus.textContent = "READY TO UPLOAD";
      updateCanvasSize();
      setMessage("Import an image, PDF, or PowerPoint (.pptx) to begin.");
    }
  }

  loadDemo();
  updateCanvasSize();
})();
