const moduleMeta = {
  home: {
    title: "Dashboard Overview",
    subtitle: "Monitor certificate operations, load student data, and print official documents from one desktop workspace."
  },
  m1: {
    title: "Bonafide Certificate - CSV Workspace",
    subtitle: "Open a CSV database, search EMIS records, edit details, and print the bonafide certificate."
  },
  m2: {
    title: "Bonafide Certificate - Excel Workspace",
    subtitle: "Connect an Excel workbook, search by EMIS or name, update entries, and save back to disk."
  },
  m3: {
    title: "Conduct & Attendance Workspace",
    subtitle: "Import Excel data, complete required values, and generate both certificates in one print flow."
  },
  about: {
    title: "About the App",
    subtitle: "Developer and contact information for the Office Certificate App."
  }
};

const appConfig = window.APP_CONFIG || {
  login: { username: "admin", password: "admin" },
  school: {}
};

let c1_db = [];
let c1_fileHandle = null;
let c2_db = [];
let c2_fileHandle = null;
let c3_db = [];

document.addEventListener("DOMContentLoaded", () => {
  setTodayDefaults();
  updateSystemDate();
  updateWorkspaceHeader("home");
  bindSearchInputs();
  prepareTransparentLogos();
  window.addEventListener("resize", handleResponsiveSidebar);
});

function setTodayDefaults() {
  setDateInputToToday("c3_certDate1");
  setValue("c3_place", appConfig.school.place || "");
}

function updateSystemDate() {
  const element = document.getElementById("system-date");
  if (!element) {
    return;
  }

  element.textContent = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function bindSearchInputs() {
  bindEnter("c1_emisSearch", c1_searchStudent);
  bindEnter("c2_emisSearch", c2_searchLocal);
  bindEnter("c3_emisSearch", c3_searchStudent);
}

function prepareTransparentLogos() {
  document.querySelectorAll("img[data-remove-bg='auto']").forEach((image) => {
    const handleLoad = () => removeImageBackground(image);

    if (image.complete && image.naturalWidth) {
      handleLoad();
      return;
    }

    image.addEventListener("load", handleLoad, { once: true });
  });
}

function removeImageBackground(image) {
  if (!image || image.dataset.bgProcessed === "true") {
    return;
  }

  const source = image.currentSrc || image.src || "";
  if (/\.svg($|\?)/i.test(source) || source.startsWith("data:image/")) {
    image.dataset.bgProcessed = "true";
    return;
  }

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) {
    return;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, width, height);

    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const threshold = Number(image.dataset.bgThreshold || 44);
    const softness = 20;
    const samples = getLogoBackgroundSamples(pixels, width, height);

    if (image.dataset.bgMode === "edge") {
      removeEdgeConnectedBackground(pixels, width, height, samples, threshold + softness);
      applyProcessedImage(image, imageData, canvas, context);
      return;
    }

    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3];
      if (!alpha) {
        continue;
      }

      const distance = getClosestColorDistance(
        pixels[index],
        pixels[index + 1],
        pixels[index + 2],
        samples
      );

      if (distance <= threshold) {
        pixels[index + 3] = 0;
        continue;
      }

      if (distance < threshold + softness) {
        const factor = (distance - threshold) / softness;
        pixels[index + 3] = Math.round(alpha * factor);
      }
    }

    applyProcessedImage(image, imageData, canvas, context);
  } catch (error) {
    image.dataset.bgProcessed = "failed";
  }
}

function applyProcessedImage(image, imageData, canvas, context) {
  context.putImageData(imageData, 0, 0);

  if (image.dataset.bgTrim === "true") {
    const bounds = getAlphaBounds(imageData.data, imageData.width, imageData.height);
    if (bounds) {
      const trimCanvas = document.createElement("canvas");
      trimCanvas.width = bounds.width;
      trimCanvas.height = bounds.height;
      trimCanvas
        .getContext("2d")
        .drawImage(canvas, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
      image.dataset.bgProcessed = "true";
      image.src = trimCanvas.toDataURL("image/png");
      return;
    }
  }

  image.dataset.bgProcessed = "true";
  image.src = canvas.toDataURL("image/png");
}

function getAlphaBounds(pixels, width, height) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha <= 8) {
        continue;
      }

      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    return null;
  }

  const padding = 2;
  left = Math.max(0, left - padding);
  top = Math.max(0, top - padding);
  right = Math.min(width - 1, right + padding);
  bottom = Math.min(height - 1, bottom + padding);

  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1
  };
}

function removeEdgeConnectedBackground(pixels, width, height, samples, threshold) {
  const visited = new Uint8Array(width * height);
  const queue = [];
  let cursor = 0;

  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) {
      return;
    }

    const colorIndex = pixelIndex * 4;
    if (!pixels[colorIndex + 3]) {
      visited[pixelIndex] = 1;
      return;
    }

    const distance = getClosestColorDistance(
      pixels[colorIndex],
      pixels[colorIndex + 1],
      pixels[colorIndex + 2],
      samples
    );

    if (distance > threshold) {
      return;
    }

    visited[pixelIndex] = 1;
    queue.push(pixelIndex);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (cursor < queue.length) {
    const pixelIndex = queue[cursor];
    cursor += 1;

    const colorIndex = pixelIndex * 4;
    pixels[colorIndex + 3] = 0;

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }
}

function getLogoBackgroundSamples(pixels, width, height) {
  const points = [
    [4, 4],
    [Math.max(4, width - 5), 4],
    [4, Math.max(4, height - 5)],
    [Math.max(4, width - 5), Math.max(4, height - 5)],
    [Math.floor(width / 2), 4],
    [Math.floor(width / 2), Math.max(4, height - 5)],
    [4, Math.floor(height / 2)],
    [Math.max(4, width - 5), Math.floor(height / 2)]
  ];

  return points.map(([x, y]) => samplePixelArea(pixels, width, height, x, y, 3));
}

function samplePixelArea(pixels, width, height, centerX, centerY, radius) {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      const x = Math.min(width - 1, Math.max(0, centerX + offsetX));
      const y = Math.min(height - 1, Math.max(0, centerY + offsetY));
      const index = (y * width + x) * 4;

      if (!pixels[index + 3]) {
        continue;
      }

      red += pixels[index];
      green += pixels[index + 1];
      blue += pixels[index + 2];
      count += 1;
    }
  }

  if (!count) {
    return { red: 255, green: 255, blue: 255 };
  }

  return {
    red: Math.round(red / count),
    green: Math.round(green / count),
    blue: Math.round(blue / count)
  };
}

function getClosestColorDistance(red, green, blue, samples) {
  return samples.reduce((closest, sample) => {
    const distance = Math.sqrt(
      ((red - sample.red) ** 2) +
      ((green - sample.green) ** 2) +
      ((blue - sample.blue) ** 2)
    );

    return Math.min(closest, distance);
  }, Number.POSITIVE_INFINITY);
}

function bindEnter(id, handler) {
  const input = document.getElementById(id);
  if (!input) {
    return;
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handler();
    }
  });
}

function handleResponsiveSidebar() {
  if (window.innerWidth > 1200) {
    toggleSidebar(false);
  }
}

function setDateInputToToday(id) {
  const input = document.getElementById(id);
  if (input) {
    input.valueAsDate = new Date();
  }
}

function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.value = value;
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function formatDateDisplay(dateValue) {
  const date = new Date(dateValue);
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

function formatIsoDate(isoDateString) {
  return isoDateString ? formatDateDisplay(new Date(isoDateString)) : " ";
}

function handleMasterLogin(event) {
  event.preventDefault();

  const username = document.getElementById("master-username").value;
  const password = document.getElementById("master-password").value;
  const error = document.getElementById("login-error");

  if (username === appConfig.login.username && password === appConfig.login.password) {
    document.getElementById("master-login").style.display = "none";
    document.getElementById("master-app").style.display = "block";
    error.style.display = "none";
    switchModule("home", document.getElementById("nav-home"));
    return;
  }

  error.style.display = "block";
}

function goHome() {
  switchModule("home", document.getElementById("nav-home"));
}

function switchModule(modId, navElement) {
  document.querySelectorAll(".nav-item").forEach((element) => element.classList.remove("active"));
  if (navElement) {
    navElement.classList.add("active");
  }

  document.querySelectorAll(".module").forEach((element) => element.classList.remove("active"));
  document.body.classList.remove("print-m1", "print-m2", "print-m3");

  if (modId === "home") {
    document.getElementById("module-home").classList.add("active");
  }

  if (modId === "m1") {
    document.getElementById("module-csv").classList.add("active");
    document.body.classList.add("print-m1");
  }

  if (modId === "m2") {
    document.getElementById("module-excel").classList.add("active");
    document.body.classList.add("print-m2");
  }

  if (modId === "m3") {
    document.getElementById("module-conduct").classList.add("active");
    document.body.classList.add("print-m3");
  }

  if (modId === "about") {
    document.getElementById("module-about").classList.add("active");
  }

  updateWorkspaceHeader(modId);
  toggleSidebar(false);
}

function updateWorkspaceHeader(moduleId) {
  const meta = moduleMeta[moduleId] || moduleMeta.home;
  setText("module-title", meta.title);
  setText("module-subtitle", meta.subtitle);
}

function toggleSidebar(forceState) {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  if (!sidebar || !overlay) {
    return;
  }

  if (window.innerWidth > 1200) {
    sidebar.classList.remove("is-open");
    overlay.classList.remove("is-visible");
    return;
  }

  const shouldOpen = typeof forceState === "boolean" ? forceState : !sidebar.classList.contains("is-open");
  sidebar.classList.toggle("is-open", shouldOpen);
  overlay.classList.toggle("is-visible", shouldOpen);
}

async function copyAboutPhone() {
  const phone = "7603930445";
  const button = document.querySelector(".about-action--copy");
  try {
    await navigator.clipboard.writeText(phone);
  } catch {
    const field = document.createElement("textarea");
    field.value = phone;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }
  if (button) {
    button.textContent = "Copied";
    window.setTimeout(() => { button.textContent = "Copy"; }, 1600);
  }
}

function capitalizeFirstLetter(value) {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function resetBonafideForm(prefix) {
  const container = document.getElementById(prefix === "c1" ? "module-csv" : "module-excel");
  if (container) {
    container.querySelectorAll("input[type='text'], textarea").forEach((field) => {
      field.value = "";
    });
  }

  setText(`${prefix}_emisDisplay`, "EMIS ID: ----");
  document.getElementById(`${prefix}_currentEmisId`).value = "";
  const photoDisplay = document.getElementById(`${prefix}_photoDisplay`);
  photoDisplay.innerHTML = `<span id="${prefix}_photoPlaceholder">Click to<br>Upload Photo</span>`;
  photoDisplay.dataset.tempPhoto = "";
}

async function c1_openFile() {
  if (!window.showOpenFilePicker) {
    alert("This browser does not support the File System Access API.");
    return;
  }

  try {
    [c1_fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: "CSV Files",
          accept: { "text/csv": [".csv"] }
        }
      ]
    });

    const file = await c1_fileHandle.getFile();
    const contents = await file.text();
    c1_parseCSV(contents);
    setText("c1_db-status", `Loaded ${c1_db.length} records from ${file.name}`);
  } catch (error) {
    alert("Could not open the CSV file.");
  }
}

function c1_captureForm() {
  const emisId = document.getElementById("c1_currentEmisId").value;
  if (!emisId) {
    return;
  }

  const index = c1_db.findIndex((student) => student.emis === emisId);
  if (index === -1) {
    return;
  }

  c1_db[index].name = document.getElementById("c1_stName").value;
  c1_db[index].aadhar = document.getElementById("c1_stAadhar").value;
  c1_db[index].fatherName = document.getElementById("c1_stFatherName").value;
  c1_db[index].motherName = document.getElementById("c1_stMotherName").value;
  c1_db[index].gender = document.getElementById("c1_stGender").value;
  c1_db[index].dob = document.getElementById("c1_stDob").value;
  c1_db[index].adminNo = document.getElementById("c1_stAdminNo").value;
  c1_db[index].dateAdmin = document.getElementById("c1_stDateAdmin").value;
  c1_db[index].academicYear = document.getElementById("c1_stYear").value;
  c1_db[index].class = document.getElementById("c1_stClass").value;
  c1_db[index].section = document.getElementById("c1_stSection").value;
  c1_db[index].medium = document.getElementById("c1_stMedium").value;
  c1_db[index].contact = document.getElementById("c1_stContact").value;
  c1_db[index].email = document.getElementById("c1_stEmail").value;
  c1_db[index].address = document.getElementById("c1_stAddress").value;
  c1_db[index].taluk = document.getElementById("c1_stTaluk").value;
  c1_db[index].district = document.getElementById("c1_stDistrict").value;
  c1_db[index].pincode = document.getElementById("c1_stPincode").value;

  const display = document.getElementById("c1_photoDisplay");
  if (display.dataset.tempPhoto) {
    c1_db[index].photo = display.dataset.tempPhoto;
  }
}

async function c1_saveFile() {
  c1_captureForm();

  if (!c1_fileHandle) {
    await c1_saveFileAs();
    return;
  }

  try {
    const writable = await c1_fileHandle.createWritable();
    await writable.write(`\uFEFF${c1_generateCSV()}`);
    await writable.close();
    alert("Saved changes permanently to disk.");
  } catch (error) {
    alert("Save failed. Permission denied.");
  }
}

async function c1_saveFileAs() {
  if (!window.showSaveFilePicker) {
    alert("This browser does not support Save As.");
    return;
  }

  c1_captureForm();

  try {
    const newHandle = await window.showSaveFilePicker({
      types: [
        {
          description: "CSV Files",
          accept: { "text/csv": [".csv"] }
        }
      ]
    });
    const writable = await newHandle.createWritable();
    await writable.write(`\uFEFF${c1_generateCSV()}`);
    await writable.close();
    alert("Saved copy successfully.");
  } catch (error) {
    // User cancelled
  }
}

function c1_handlePhotoUpload(input) {
  if (!input.files || !input.files[0]) {
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const image = new Image();
    image.src = event.target.result;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 150;
      canvas.height = 200;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, 150, 200);
      const base64 = canvas.toDataURL("image/jpeg", 0.7);
      const display = document.getElementById("c1_photoDisplay");
      display.innerHTML = `<img src="${base64}" alt="Student photo">`;
      display.dataset.tempPhoto = base64;
    };
  };
  reader.readAsDataURL(input.files[0]);
}

function c1_parseCSV(text) {
  const lines = text.split("\n");
  if (lines.length < 2) {
    return;
  }

  const headers = lines[0].toLowerCase().split(",").map((header) => header.trim().replace(/[^a-z0-9]/g, ""));
  const findHeader = (keywords) => {
    for (const keyword of keywords) {
      const index = headers.findIndex((header) => header.includes(keyword));
      if (index !== -1) {
        return index;
      }
    }
    return -1;
  };

  const map = {
    emis: findHeader(["emis", "id"]),
    name: headers.findIndex((header) => header.includes("name") && !header.includes("father") && !header.includes("mother")),
    aadhar: findHeader(["aadhar", "uid"]),
    fatherName: headers.findIndex((header) => header.includes("father") && !header.includes("mother")),
    motherName: headers.findIndex((header) => header.includes("mother")),
    gender: findHeader(["gender", "sex"]),
    dob: findHeader(["dob", "birth"]),
    adminNo: headers.findIndex((header) => header.includes("admin") || header.includes("adm")),
    dateAdmin: findHeader(["dateofadm", "admdate", "dateadmin", "doj", "doa", "admissiondate", "dateofadmission"]),
    academicYear: findHeader(["year", "academic"]),
    class: findHeader(["class", "std"]),
    section: findHeader(["section", "sec"]),
    medium: findHeader(["medium", "med"]),
    contact: findHeader(["contact", "phone"]),
    email: findHeader(["email", "mail"]),
    address: findHeader(["address", "addr"]),
    taluk: findHeader(["taluk", "tk"]),
    district: findHeader(["district", "dist"]),
    pincode: findHeader(["pin", "zip"]),
    photo: findHeader(["photo", "image"])
  };

  c1_db = [];

  for (let index = 1; index < lines.length; index += 1) {
    if (!lines[index].trim()) {
      continue;
    }

    const row = lines[index].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const getValue = (columnIndex) => {
      if (columnIndex === -1 || !row[columnIndex]) {
        return "";
      }

      let value = row[columnIndex].trim();
      if (value.startsWith("\"") && value.endsWith("\"")) {
        value = value.substring(1, value.length - 1);
      }
      return value.replace(/""/g, "\"");
    };

    let photoData = getValue(map.photo);
    if (map.photo !== -1 && row.length > map.photo + 1) {
      photoData = row[map.photo] + "," + row.slice(map.photo + 1).join(",");
      photoData = photoData.trim();
      if (photoData.startsWith("\"")) {
        photoData = photoData.substring(1, photoData.length - 1);
      }
    }

    c1_db.push({
      emis: getValue(map.emis),
      name: getValue(map.name),
      aadhar: getValue(map.aadhar),
      fatherName: getValue(map.fatherName),
      motherName: getValue(map.motherName),
      gender: getValue(map.gender),
      dob: getValue(map.dob),
      adminNo: getValue(map.adminNo),
      dateAdmin: getValue(map.dateAdmin),
      academicYear: getValue(map.academicYear),
      class: getValue(map.class),
      section: getValue(map.section),
      medium: getValue(map.medium),
      contact: getValue(map.contact),
      email: getValue(map.email),
      address: getValue(map.address).replace(/\|/g, "\n"),
      taluk: getValue(map.taluk),
      district: getValue(map.district),
      pincode: getValue(map.pincode),
      photo: photoData
    });
  }
}

function c1_generateCSV() {
  let csv = "EMIS,Name,Aadhar,FatherName,MotherName,Gender,DOB,AdmissionNo,DateOfAdmission,AcademicYear,Class,Section,Medium,Contact,Email,Address,Taluk,District,Pincode,Photo\n";

  c1_db.forEach((record) => {
    let address = (record.address || "").replace(/\n/g, " | ");
    if (address.includes(",")) {
      address = `"${address}"`;
    }

    let photo = record.photo || "";
    if (photo.length > 0) {
      photo = `"${photo}"`;
    }

    csv += [
      record.emis,
      record.name,
      record.aadhar,
      record.fatherName,
      record.motherName,
      record.gender,
      record.dob,
      record.adminNo,
      record.dateAdmin,
      record.academicYear,
      record.class,
      record.section,
      record.medium,
      record.contact,
      record.email,
      address,
      record.taluk,
      record.district,
      record.pincode,
      photo
    ].join(",") + "\n";
  });

  return csv;
}

function c1_searchStudent() {
  const emisId = document.getElementById("c1_emisSearch").value.trim();
  const record = c1_db.find((student) => student.emis === emisId);

  if (!record) {
    alert("Student not found.");
    c1_clearForm();
    return;
  }

  c1_populate(record);
}

function c1_populate(data) {
  setValue("c1_stName", data.name || "");
  setValue("c1_stAadhar", data.aadhar || "");
  setValue("c1_stFatherName", data.fatherName || "");
  setValue("c1_stMotherName", data.motherName || "");
  setValue("c1_stGender", data.gender || "");
  setValue("c1_stDob", data.dob || "");
  setValue("c1_stAdminNo", data.adminNo || "");
  setValue("c1_stDateAdmin", data.dateAdmin || "");
  setValue("c1_stYear", data.academicYear || "");
  setValue("c1_stClass", data.class || "");
  setValue("c1_stSection", (data.section || "").toUpperCase());
  setValue("c1_stContact", data.contact || "");
  setValue("c1_stEmail", data.email || "");
  setValue("c1_stAddress", data.address || "");
  setValue("c1_stTaluk", capitalizeFirstLetter(data.taluk));
  setValue("c1_stDistrict", capitalizeFirstLetter(data.district));
  setValue("c1_stPincode", data.pincode || "");

  let medium = (data.medium || "").toUpperCase();
  if (medium.includes("TAMIL")) {
    medium = "TAMIL MEDIUM";
  } else if (medium.includes("ENGLISH")) {
    medium = "ENGLISH MEDIUM";
  }
  setValue("c1_stMedium", medium);

  setText("c1_emisDisplay", `EMIS ID: ${data.emis}`);
  setValue("c1_currentEmisId", data.emis || "");

  const photoDisplay = document.getElementById("c1_photoDisplay");
  if (data.photo && data.photo.length > 10) {
    photoDisplay.innerHTML = `<img src="${data.photo}" alt="Student photo">`;
    photoDisplay.dataset.tempPhoto = data.photo;
  } else {
    photoDisplay.innerHTML = `<span id="c1_photoPlaceholder">Click to<br>Upload Photo</span>`;
    photoDisplay.dataset.tempPhoto = "";
  }
}

function c1_clearForm() {
  resetBonafideForm("c1");
}

async function c2_openDatabase() {
  if (!window.showOpenFilePicker) {
    alert("This browser does not support the File System Access API.");
    return;
  }

  try {
    [c2_fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: "Excel Files",
          accept: {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
            "application/vnd.ms-excel": [".xls"]
          }
        }
      ]
    });

    const file = await c2_fileHandle.getFile();
    const workbook = XLSX.read(await file.arrayBuffer());
    c2_db = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "", raw: true });

    const status = document.getElementById("c2_file-status");
    status.textContent = `Connected: ${file.name}`;
    status.classList.remove("command-status--muted");
  } catch (error) {
    // User cancelled
  }
}

function c2_newTemplate() {
  try {
    const emptyData = [
      {
        "EMIS ID": "",
        Name: "",
        Aadhar: "",
        FatherName: "",
        MotherName: "",
        Gender: "",
        DOB: "",
        AdmissionNo: "",
        DateOfAdmission: "",
        AcademicYear: "",
        Class: "",
        Section: "",
        Medium: "",
        Contact: "",
        Email: "",
        Address: "",
        Taluk: "",
        District: "",
        Pincode: ""
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(emptyData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    XLSX.writeFile(workbook, "Student_Database_Template.xlsx");
  } catch (error) {
    alert("Failed to generate the Excel template.");
  }
}

async function c2_saveToDisk() {
  if (!c2_fileHandle) {
    alert("Open the Excel database first.");
    return;
  }

  const emisId = document.getElementById("c2_currentEmisId").value;
  if (emisId) {
    c2_updateDbObj(emisId);
  }

  if (c2_db.length === 0) {
    alert("Database is empty.");
    return;
  }

  try {
    const options = { mode: "readwrite" };
    if ((await c2_fileHandle.queryPermission(options)) !== "granted") {
      if ((await c2_fileHandle.requestPermission(options)) !== "granted") {
        alert("Permission denied.");
        return;
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(c2_db);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    const workbookOut = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([workbookOut], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const writable = await c2_fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    alert("Saved to disk successfully.");
  } catch (error) {
    alert("Save failed. Close the Excel file if it is open elsewhere.");
  }
}

function c2_updateDbObj(emis) {
  const updatedRow = {
    EMIS: emis,
    Name: document.getElementById("c2_stName").value,
    Aadhar: document.getElementById("c2_stAadhar").value,
    FatherName: document.getElementById("c2_stFatherName").value,
    MotherName: document.getElementById("c2_stMotherName").value,
    Gender: document.getElementById("c2_stGender").value,
    DOB: document.getElementById("c2_stDob").value,
    AdminNo: document.getElementById("c2_stAdminNo").value,
    DateAdmin: document.getElementById("c2_stDateAdmin").value,
    Year: document.getElementById("c2_stYear").value,
    Class: document.getElementById("c2_stClass").value,
    Section: document.getElementById("c2_stSection").value,
    Medium: document.getElementById("c2_stMedium").value,
    Contact: document.getElementById("c2_stContact").value,
    Email: document.getElementById("c2_stEmail").value,
    Address: document.getElementById("c2_stAddress").value,
    Taluk: document.getElementById("c2_stTaluk").value,
    District: document.getElementById("c2_stDistrict").value,
    Pincode: document.getElementById("c2_stPincode").value,
    Photo: document.querySelector("#c2_photoDisplay img") ? document.querySelector("#c2_photoDisplay img").src : ""
  };

  const index = c2_db.findIndex((row) => String(c2_smartGet(row, ["EMIS", "EMIS ID"])) === String(emis));
  if (index >= 0) {
    c2_db[index] = updatedRow;
  } else {
    c2_db.push(updatedRow);
  }
}

function c2_smartGet(row, keys) {
  if (!row) {
    return "";
  }

  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") {
      return String(row[key]).trim();
    }
  }

  const normalize = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  const rowKeys = Object.keys(row).map((key) => ({ original: key, normalized: normalize(key) }));

  for (const key of keys) {
    const normalizedKey = normalize(key);
    const exactMatch = rowKeys.find((item) => item.normalized === normalizedKey);
    if (exactMatch && row[exactMatch.original]) {
      return String(row[exactMatch.original]).trim();
    }
  }

  for (const key of keys) {
    const normalizedKey = normalize(key);
    if (normalizedKey.length < 3) {
      continue;
    }

    const partialMatch = rowKeys.find((item) => item.normalized.includes(normalizedKey));
    if (partialMatch && row[partialMatch.original]) {
      return String(row[partialMatch.original]).trim();
    }
  }

  return "";
}

function c2_fmtDate(value) {
  if (!value) {
    return "";
  }

  const stringValue = String(value).trim();
  if (!Number.isNaN(Number(stringValue)) && Number(stringValue) > 10000 && Number(stringValue) < 99999) {
    const date = new Date(Math.round((Number(stringValue) - 25569) * 86400 * 1000));
    return formatDateDisplay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())));
  }

  return stringValue.replace(/[/.]/g, "-");
}

function c2_searchLocal() {
  const query = document.getElementById("c2_emisSearch").value.trim().toLowerCase();
  const record = c2_db.find((row) => {
    const emis = c2_smartGet(row, ["EMIS", "EMIS ID"]).toLowerCase();
    const name = c2_smartGet(row, ["Name"]).toLowerCase();
    return (emis && emis === query) || (name && name.includes(query));
  });

  if (!record) {
    alert("Student not found.");
    c2_clearForm();
    return;
  }

  c2_populate(record);
}

function c2_populate(row) {
  setValue("c2_stName", c2_smartGet(row, ["Name"]));
  setValue("c2_stAadhar", c2_smartGet(row, ["Aadhar", "UID"]));
  setValue("c2_stGender", c2_smartGet(row, ["Gender"]));
  setValue("c2_stDob", c2_fmtDate(c2_smartGet(row, ["DOB", "DATE OF BIRTH"])));
  setValue("c2_stDateAdmin", c2_fmtDate(c2_smartGet(row, ["DateOfAdmission", "DATE OF ADMISSION", "Date of Admission", "DateAdmin", "Admission Date", "DOA"])));
  setValue("c2_stAdminNo", c2_smartGet(row, ["AdmissionNo", "ADMISSION NO", "Admission No", "AdminNo", "Admission Number", "Adm No"]));
  setValue("c2_stFatherName", c2_smartGet(row, ["FatherName"]));
  setValue("c2_stMotherName", c2_smartGet(row, ["MotherName"]));
  setValue("c2_stClass", c2_smartGet(row, ["Class", "Std"]));
  setValue("c2_stSection", c2_smartGet(row, ["Section", "Sec"]));
  setValue("c2_stMedium", c2_smartGet(row, ["Medium"]));
  setValue("c2_stContact", c2_smartGet(row, ["Contact", "Phone"]));
  setValue("c2_stEmail", c2_smartGet(row, ["Email"]));
  setValue("c2_stAddress", c2_smartGet(row, ["Address"]));

  let academicYear = c2_smartGet(row, ["AcademicYear", "Year"]);
  if (!academicYear) {
    academicYear = "2024-2025";
  }
  setValue("c2_stYear", academicYear);

  setValue("c2_stTaluk", capitalizeFirstLetter(c2_smartGet(row, ["Taluk"])));
  setValue("c2_stDistrict", capitalizeFirstLetter(c2_smartGet(row, ["District"])));
  setValue("c2_stPincode", c2_smartGet(row, ["Pincode", "Pin"]));

  const emis = c2_smartGet(row, ["EMIS", "EMIS ID"]);
  setValue("c2_currentEmisId", emis);
  setText("c2_emisDisplay", `EMIS ID: ${emis}`);

  const photo = c2_smartGet(row, ["Photo", "Image"]);
  const display = document.getElementById("c2_photoDisplay");
  if (photo.length > 50) {
    display.innerHTML = `<img src="${photo}" alt="Student photo">`;
  } else {
    display.innerHTML = `<span id="c2_photoPlaceholder">Click to<br>Upload Photo</span>`;
  }
}

function c2_handlePhotoUpload(input) {
  if (!input.files || !input.files[0]) {
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const image = new Image();
    image.src = event.target.result;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 150;
      canvas.height = 190;
      canvas.getContext("2d").drawImage(image, 0, 0, 150, 190);
      document.getElementById("c2_photoDisplay").innerHTML = `<img src="${canvas.toDataURL("image/jpeg", 0.7)}" alt="Student photo">`;
    };
  };
  reader.readAsDataURL(input.files[0]);
}

function c2_clearForm() {
  resetBonafideForm("c2");
}

function c3_showStatus(message, type = "success") {
  const statusBar = document.getElementById("c3_statusBar");
  statusBar.textContent = message;
  statusBar.style.display = "block";
  statusBar.style.background = type === "success" ? "#d8f1e5" : "#f7d9d9";
  statusBar.style.color = type === "success" ? "#175f43" : "#7f2727";
  setTimeout(() => {
    statusBar.style.display = "none";
  }, 5000);
}

function c3_handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  c3_showStatus("Reading Excel file...");
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    try {
      const workbook = XLSX.read(new Uint8Array(loadEvent.target.result), { type: "array" });
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
      c3_processData(matrix);
    } catch (error) {
      c3_showStatus("Failed to parse Excel file.", "error");
    }
  };

  reader.readAsArrayBuffer(file);
  event.target.value = "";
}

function c3_processData(matrix) {
  if (matrix.length < 2) {
    return;
  }

  let headerRow = -1;
  let headers = [];

  for (let index = 0; index < Math.min(10, matrix.length); index += 1) {
    const row = matrix[index];
    if (!row) {
      continue;
    }

    const cleaned = row.map((cell) => String(cell).toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (cleaned.some((header) => header.includes("emis"))) {
      headerRow = index;
      headers = cleaned;
      break;
    }
  }

  if (headerRow === -1) {
    alert("No EMIS header found in the uploaded file.");
    return;
  }

  const findHeader = (keywords) => {
    for (const keyword of keywords) {
      const index = headers.findIndex((header) => header.includes(keyword));
      if (index !== -1) {
        return index;
      }
    }
    return -1;
  };

  const map = {
    emis: findHeader(["emis"]),
    admn: findHeader(["admn", "admno", "admission", "adm"]),
    name: findHeader(["name"]),
    class: findHeader(["class", "std"]),
    section: findHeader(["section", "sec"]),
    studyFrom: findHeader(["from"]),
    studyTo: findHeader(["to"]),
    year: findHeader(["year"]),
    teacher: findHeader(["teacher"])
  };

  c3_db = [];

  for (let index = headerRow + 1; index < matrix.length; index += 1) {
    const row = matrix[index];
    if (!row || row.every((cell) => String(cell).trim() === "")) {
      continue;
    }

    const getValue = (columnIndex) => (columnIndex === -1 ? "" : String(row[columnIndex]).trim());
    if (getValue(map.emis)) {
      c3_db.push({
        emis: getValue(map.emis),
        admn: getValue(map.admn),
        name: getValue(map.name),
        class: getValue(map.class),
        section: getValue(map.section),
        studyFrom: getValue(map.studyFrom),
        studyTo: getValue(map.studyTo),
        year: getValue(map.year),
        teacher: getValue(map.teacher)
      });
    }
  }

  c3_showStatus(`Imported ${c3_db.length} records.`);
}

function c3_searchStudent() {
  const query = String(document.getElementById("c3_emisSearch").value).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const student = c3_db.find((record) => String(record.emis).replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === query);

  if (!student) {
    alert("Student not found.");
    c3_clearForm();
    return;
  }

  c3_populateForm(student);
  c3_showStatus(`Found: ${student.name}`);
}

function c3_populateForm(data) {
  setValue("c3_emisNo", data.emis || "");
  setValue("c3_admnNo", data.admn || "");
  setValue("c3_studentName", data.name || "");
  setValue("c3_className", data.class || "");
  setValue("c3_sectionName", data.section || "");
  setValue("c3_studyFrom", data.studyFrom || "");
  setValue("c3_studyTo", data.studyTo || "");
  setValue("c3_academicYear", data.year || "");
  setValue("c3_teacherName", data.teacher || "");
  c3_updateCertificates();
}

function c3_updateCertificates() {
  const getValue = (id) => document.getElementById(id).value || " ";
  const displayDate = formatIsoDate(document.getElementById("c3_certDate1").value);
  const name = getValue("c3_studentName");
  const prefix = inferGenderPrefix(name);

  setText("c3_displayEmis1", getValue("c3_emisNo"));
  setText("c3_displayAdmn1", getValue("c3_admnNo"));
  setText("c3_displayTcNo1", getValue("c3_tcNo"));
  setText("c3_genderPrefix1", prefix);
  setText("c3_displayName1", name);
  setText("c3_displayClass1", getValue("c3_className"));
  setText("c3_displaySection1", getValue("c3_sectionName"));
  setText("c3_displayStudyFrom1", getValue("c3_studyFrom"));
  setText("c3_displayStudyTo1", getValue("c3_studyTo"));
  setText("c3_displayConduct", getValue("c3_conduct"));
  setText("c3_displayPlace", getValue("c3_place"));
  setText("c3_displayDate", displayDate);

  setText("c3_displayEmis2", getValue("c3_emisNo"));
  setText("c3_displayAdmn2", getValue("c3_admnNo"));
  setText("c3_displayTcNo2", getValue("c3_tcNo"));
  setText("c3_genderPrefix2", prefix);
  setText("c3_displayName2", name);
  setText("c3_displayYear", getValue("c3_academicYear"));
  setText("c3_displayAttendance", getValue("c3_attendance"));
  setText("c3_displayTeacher", getValue("c3_teacherName"));
}

function inferGenderPrefix(name) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) {
    return "Selvan/Selvi";
  }

  return /[aei][^aeiou]*$/.test(normalized) && !/(an|ar|en|in|on|un)$/i.test(normalized) ? "Selvi" : "Selvan";
}

function c3_clearAll() {
  document.getElementById("c3_emisSearch").value = "";
  c3_clearForm();
}

function c3_clearForm() {
  [
    "c3_emisNo",
    "c3_admnNo",
    "c3_studentName",
    "c3_className",
    "c3_sectionName",
    "c3_studyFrom",
    "c3_studyTo",
    "c3_academicYear",
    "c3_teacherName",
    "c3_tcNo",
    "c3_conduct",
    "c3_attendance"
  ].forEach((id) => setValue(id, ""));

  setValue("c3_place", appConfig.school.place || "");
  setDateInputToToday("c3_certDate1");
  c3_updateCertificates();
}
