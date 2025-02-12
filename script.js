/********************************************
 *  1) POCKETBASE SETUP & LOGIN/REGISTER
 ********************************************/
//  Make sure you link to the PocketBase client in your HTML, e.g.:
//  <script src="https://cdn.jsdelivr.net/npm/pocketbase@0.13.3/dist/pocketbase.umd.js"></script>
//  Then include *this* script AFTER that, e.g. <script src="script.js"></script>

const pb = new PocketBase("https://pocketbase-production-533b.up.railway.app/");
// e.g. "http://127.0.0.1:8090" or your deployed PB server

document.addEventListener("DOMContentLoaded", async () => {
  // Check if user is already logged in
  if (pb.authStore.isValid) {
    showAppSection();
  } else {
    showLoginSection();
  }
});

/**
 * Attempts to log in with the email/password.
 * On success, hides the login form and shows the main app.
 */
async function login() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  const msgEl = document.getElementById("loginMessage");

  try {
    await pb.collection("users").authWithPassword(email, password);
    msgEl.textContent = "Logged in!";
    showAppSection();
    fetchPreviousResults(); 
  } catch (err) {
    msgEl.textContent = "Login failed: " + err.message;
  }
}

/**
 * Registers a new user in PocketBase, then logs them in.
 */
async function registerUser() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  const msgEl = document.getElementById("loginMessage");

  try {
    // 1) Create user record
    await pb.collection("users").create({
      email: email,
      password: password,
      passwordConfirm: password
    });
    // 2) Log in
    await pb.collection("users").authWithPassword(email, password);
    msgEl.textContent = "Registered & logged in!";
    showAppSection();
  } catch (err) {
    msgEl.textContent = "Registration failed: " + err.message;
  }
}

/**
 * Hides login, shows main CBT app container
 */
function showAppSection() {
  fetchPreviousResults(); 
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("appSection").style.display = "block";
}

/**
 * Hides main CBT app container, shows login
 */
function showLoginSection() {
  document.getElementById("loginSection").style.display = "block";
  document.getElementById("appSection").style.display = "none";
}

/********************************************
 *  2) SAVE & FETCH CBT ENTRIES
 ********************************************/
/**
 * Builds a summary of all the CBT fields, then saves to PocketBase
 */
async function saveToDB() {
    const saveMsg = document.getElementById("saveMessage");

    if (isFormEmpty()) {
        saveMsg.textContent = "Please fill in at least one field before saving.";
        return; // abort saving if nothing is entered
    }

    saveMsg.textContent = "...saving...";
    
    try {
      const title = document.getElementById("entryTitle").value.trim() || "Untitled Entry";
      const content = buildSummary(); // builds the summary of CBT inputs
  
      // Create a record in your "cognitive_restructures" collection.
      await pb.collection("cognitive_restructures").create({
        title: title,
        content: content,
        userId: pb.authStore.model.id
      });
  
      // Immediately refresh the results list so the new entry appears
      fetchPreviousResults();
  
      // Change the message to include a link to the CBT results tab
      saveMsg.innerHTML = "Saved! <a href='#' id='seeResultsLink'>See results page</a>";
      document.getElementById("seeResultsLink").addEventListener("click", (e) => {
        e.preventDefault();
        // Call the openTab function with a dummy event and Tab2 as the target tab
        openTab(new Event("click"), "Tab2");
      });
    } catch (err) {
      saveMsg.textContent = "Error saving: " + err.message;
    }
  }

function isFormEmpty() {
    // Select all text inputs and textareas in the container (adjust the selector if needed)
    const fields = document.querySelectorAll(".container input[type='text'], .container textarea");
    for (let field of fields) {
      if (field.value.trim() !== "") {
        return false; // found at least one field with content
      }
    }
    return true; // all fields are empty
  }
  

/**
 * Fetches all CBT entries for the current user and displays them in a list.
 */
async function fetchPreviousResults() {
    const resultsList = document.getElementById("resultsList");
    resultsList.innerHTML = "Loading...";
  
    try {
      // Specify the batch size (e.g., 100) to ensure correct URL formation
      const records = await pb.collection("cognitive_restructures").getFullList(100, {
        sort: "-created" // Sort by creation date in descending order
      });
  
      if (!records.length) {
        resultsList.innerHTML = "<p>No previous entries yet.</p>";
        return;
      }
  
      // Clear the loading message
      resultsList.innerHTML = "";
  
      // Apply grid layout styles
      resultsList.style.display = "grid";
      resultsList.style.gridTemplateColumns = "repeat(auto-fill, minmax(250px, 1fr))";
      resultsList.style.gap = "1rem";
  
      // Iterate through the records and create elements for each
      records.forEach((rec) => {
        const card = document.createElement("div");
        card.className = "result-card";
        card.style.padding = "1rem";
        card.style.border = "1px solid #444";
        card.style.borderRadius = "8px";
        card.style.backgroundColor = "#2a2a2a";
        card.style.cursor = "pointer";
        card.style.transition = "transform 0.2s";
        card.textContent = `${rec.title} — ${new Date(rec.created).toLocaleString()}`;
        
        // Position card relatively so we can absolutely position the delete button
        card.style.position = "relative";
        
        // Create the delete button element
        const deleteBtn = document.createElement("span");
        deleteBtn.textContent = "×"; // Unicode multiplication sign
        deleteBtn.className = "delete-btn";
        
        // When clicking the delete button, prevent the card’s click event from firing
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteEntry(rec.id);
        });
        
        // Append the delete button to the card
        card.appendChild(deleteBtn);
        
        // When the card is clicked, show details (as before)
        card.addEventListener("click", () => showResultDetails(rec));
        
        resultsList.appendChild(card);
      });
    } catch (err) {
      resultsList.innerHTML = "Error loading results: " + err.message;
    }
  }
  
  
  
  

/**
 * Toggles showing the full details of a single result record.
 */
function showResultDetails(record) {
    const modal = document.getElementById("resultModal");
    const modalContent = document.getElementById("resultModalContent");
  
    // Populate modal content – you might want to format the details nicely
    modalContent.textContent = record.content;  // You can use innerHTML if your content contains HTML
  
    // Display the modal
    modal.style.display = "block";
  }

/********************************************
 *  3) ALL YOUR ORIGINAL CBT LOGIC
 ********************************************/

/* --------------------------
   Toggle big instructions
-------------------------- */
function toggleInstructions() {
  const content = document.getElementById("instructionsContent");
  content.classList.toggle("open");
}

/* --------------------------
   Toggle accordions
-------------------------- */
function toggleAccordion(id) {
  const el = document.getElementById(id);
  el.classList.toggle("open");
}

/* --------------------------
   Show/hide additional feeling blocks
-------------------------- */
function showFeelingBlock(num) {
  const block = document.getElementById(`feelingBlock${num}`);
  if (block) {
    block.classList.remove("hidden");
  }

  // Hide the "Add Another Feeling" button once a block is revealed
  if (num === 2) {
    document.getElementById("showBlock2Btn").classList.add("hidden");
  } else if (num === 3) {
    document.getElementById("showBlock3Btn").classList.add("hidden");
  }
}

/* --------------------------
   Sub-feelings data + select logic
-------------------------- */
const subFeelingsMap = {
  fearAnxiety: [
    "Helpless","Frightened","Panic","Hysterical","Inferior","Inadequate",
    "Worried","Anxious","Apprehensive","Nervous","Scared","Terror"
  ],
  sadnessDepression: [
    "Hurt","Depressed","Sorrow","Dismayed","Displeased","Regretful","Isolated",
    "Lonely","Grief","Powerless","Neglected","Despair","Shameful","Disappointed"
  ],
  guiltShame: [
    "Guilty","Ashamed","Remorseful","Embarrassed","Humiliated"
  ],
  anger: [
    "Agitated","Hostile","Hate","Rage","Irritable","Frustrated","Jealous",
    "Contempt","Resentful","Revolted","Aggravated"
  ]
};

// Hook up your #feelingSelect1..3 to the populate function
const feelingSelect1 = document.getElementById("feelingSelect1");
const subFeelingSelect1 = document.getElementById("subFeelingSelect1");
feelingSelect1.addEventListener("change", () => populateSubFeelings(feelingSelect1, subFeelingSelect1));

const feelingSelect2 = document.getElementById("feelingSelect2");
const subFeelingSelect2 = document.getElementById("subFeelingSelect2");
feelingSelect2.addEventListener("change", () => populateSubFeelings(feelingSelect2, subFeelingSelect2));

const feelingSelect3 = document.getElementById("feelingSelect3");
const subFeelingSelect3 = document.getElementById("subFeelingSelect3");
feelingSelect3.addEventListener("change", () => populateSubFeelings(feelingSelect3, subFeelingSelect3));

function populateSubFeelings(broadSelect, subSelect) {
  subSelect.innerHTML = '<option value="" disabled selected>Select...</option>';
  const val = broadSelect.value;
  if (subFeelingsMap[val]) {
    subFeelingsMap[val].forEach(sf => {
      const opt = document.createElement("option");
      opt.value = sf;
      opt.textContent = sf;
      subSelect.appendChild(opt);
    });
    subSelect.disabled = false;
  } else {
    subSelect.disabled = true;
  }
}

/* --------------------------
   Distortions modal
-------------------------- */
function openDistortionsModal() {
  document.getElementById("distortionsModal").style.display = "block";
}
function closeDistortionsModal() {
  document.getElementById("distortionsModal").style.display = "none";
}

function getSelectedDistortions() {
  const checks = document.querySelectorAll('.distortion-grid input[type="checkbox"]:checked');
  const selected = [];
  checks.forEach(ch => selected.push(ch.value));
  return selected;
}
document.querySelectorAll('.distortion-grid input[type="checkbox"]').forEach(ch => {
  ch.addEventListener('change', updateDistortionsList);
});
function updateDistortionsList() {
  const selected = getSelectedDistortions();
  const container = document.getElementById("chosenDistortions");
  const distortionMsg = document.getElementById("distortionMessage");

  if (selected.length) {
    container.textContent = "Selected Distortions: " + selected.join(", ");
    distortionMsg.innerHTML = `
      You chose some distortions:
      <strong>${selected.join(", ")}</strong><br/>
      This means you may already believe the thought to be inaccurate.
      Ask yourself <em>why</em>.
    `;
  } else {
    container.textContent = "";
    distortionMsg.innerHTML = "";
  }
}

/* --------------------------
   Priority highlighting
-------------------------- */
function highlightHighestPriority() {
  const blockIds = [1,2,3];
  let maxPriority = 0;
  const blocksData = [];

  blockIds.forEach(num => {
    const block = document.getElementById(`feelingBlock${num}`);
    if (!block.classList.contains("hidden")) {
      const val = parseInt(document.getElementById(`priorityScale${num}`).value) || 0;
      blocksData.push({ block, priority: val });
    }
  });

  if (blocksData.length) {
    maxPriority = Math.max(...blocksData.map(item => item.priority));
  }

  // reset & highlight
  blocksData.forEach(item => {
    item.block.style.border = "none";
    item.block.style.backgroundColor = "";
    if (item.priority === maxPriority && maxPriority > 0) {
      item.block.style.border = "2px solid #5ef939";
      item.block.style.backgroundColor = "#1b3c1b";
    }
  });
}

/* --------------------------
   Thoughts logic
-------------------------- */
function addThoughtRow() {
  const container = document.getElementById('thoughtContainer');
  const row = document.createElement('div');
  row.className = 'thought-row';

  const textArea = document.createElement('textarea');
  textArea.className = 'thought-text thought-textarea';
  textArea.placeholder = 'Enter a thought...';
  textArea.addEventListener('input', autoResize);

  const ratingInput = document.createElement('input');
  ratingInput.type = 'number';
  ratingInput.min = '1';
  ratingInput.max = '10';
  ratingInput.step = '1';
  ratingInput.className = 'thought-rating';
  ratingInput.placeholder = '1-10';
  ratingInput.oninput = highlightMostDistressingThought;

  row.appendChild(textArea);
  row.appendChild(ratingInput);
  container.appendChild(row);

  // auto-size right away
  autoResize({ target: textArea });
}
function highlightMostDistressingThought() {
  const rows = document.querySelectorAll('#thoughtContainer .thought-row');
  let maxRating = 0;

  rows.forEach(r => {
    const val = parseInt(r.querySelector('.thought-rating').value) || 0;
    if (val > maxRating) maxRating = val;
  });

  rows.forEach(r => {
    r.style.border = 'none';
    r.style.backgroundColor = '';
    const val = parseInt(r.querySelector('.thought-rating').value) || 0;
    if (val === maxRating && maxRating > 0) {
      r.style.border = '2px solid red';
      r.style.backgroundColor = '#3b1c1c';
    }
  });
}
function getAllThoughts() {
  const rows = document.querySelectorAll('#thoughtContainer .thought-row');
  const data = [];
  rows.forEach((r) => {
    const thoughtValue = r.querySelector('.thought-text').value.trim();
    const ratingValue = r.querySelector('.thought-rating').value.trim();
    if (thoughtValue) {
      data.push({ thought: thoughtValue, distress: ratingValue });
    }
  });
  return data;
}

/* --------------------------
   Evidence FOR
-------------------------- */
function addEvidenceForRow() {
  const container = document.getElementById('evidenceForContainer');
  const row = document.createElement('div');
  row.className = 'evidence-row';

  const textArea = document.createElement('textarea');
  textArea.className = 'evidence-text evidence-textarea';
  textArea.placeholder = 'Evidence FOR...';
  textArea.addEventListener('input', autoResize);

  const ratingInput = document.createElement('input');
  ratingInput.type = 'number';
  ratingInput.min = '1';
  ratingInput.max = '10';
  ratingInput.step = '1';
  ratingInput.className = 'evidence-rating';
  ratingInput.placeholder = '1-10';
  ratingInput.oninput = highlightHighestFor;

  row.appendChild(textArea);
  row.appendChild(ratingInput);
  container.appendChild(row);

  autoResize({ target: textArea });
}
function highlightHighestFor() {
  const rows = document.querySelectorAll('#evidenceForContainer .evidence-row');
  let maxVal = 0;
  rows.forEach(r => {
    const val = parseInt(r.querySelector('.evidence-rating').value) || 0;
    if (val > maxVal) maxVal = val;
  });
  rows.forEach(r => {
    r.style.border = 'none';
    r.style.backgroundColor = '';
    const val = parseInt(r.querySelector('.evidence-rating').value) || 0;
    if (val === maxVal && maxVal > 0) {
      r.style.border = '2px solid #007bff';
      r.style.backgroundColor = 'rgba(0,123,255,0.2)';
    }
  });
}
function getAllEvidenceFor() {
  const rows = document.querySelectorAll('#evidenceForContainer .evidence-row');
  const data = [];
  rows.forEach(r => {
    const textVal = r.querySelector('.evidence-text').value.trim();
    const ratingVal = r.querySelector('.evidence-rating').value.trim();
    if (textVal) {
      data.push({ text: textVal, rating: ratingVal });
    }
  });
  return data;
}

/* --------------------------
   Evidence AGAINST
-------------------------- */
function addEvidenceAgainstRow() {
  const container = document.getElementById('evidenceAgainstContainer');
  const row = document.createElement('div');
  row.className = 'evidence-row';

  const textArea = document.createElement('textarea');
  textArea.className = 'evidence-text evidence-textarea';
  textArea.placeholder = 'Evidence AGAINST...';
  textArea.addEventListener('input', autoResize);

  const ratingInput = document.createElement('input');
  ratingInput.type = 'number';
  ratingInput.min = '1';
  ratingInput.max = '10';
  ratingInput.step = '1';
  ratingInput.className = 'evidence-rating';
  ratingInput.placeholder = '1-10';
  ratingInput.oninput = highlightHighestAgainst;

  row.appendChild(textArea);
  row.appendChild(ratingInput);
  container.appendChild(row);

  autoResize({ target: textArea });
}
function highlightHighestAgainst() {
  const rows = document.querySelectorAll('#evidenceAgainstContainer .evidence-row');
  let maxVal = 0;
  rows.forEach(r => {
    const val = parseInt(r.querySelector('.evidence-rating').value) || 0;
    if (val > maxVal) maxVal = val;
  });
  rows.forEach(r => {
    r.style.border = 'none';
    r.style.backgroundColor = '';
    const val = parseInt(r.querySelector('.evidence-rating').value) || 0;
    if (val === maxVal && maxVal > 0) {
      r.style.border = '2px solid #cc33cc';
      r.style.backgroundColor = 'rgba(204,51,204,0.2)';
    }
  });
}
function getAllEvidenceAgainst() {
  const rows = document.querySelectorAll('#evidenceAgainstContainer .evidence-row');
  const data = [];
  rows.forEach(r => {
    const textVal = r.querySelector('.evidence-text').value.trim();
    const ratingVal = r.querySelector('.evidence-rating').value.trim();
    if (textVal) {
      data.push({ text: textVal, rating: ratingVal });
    }
  });
  return data;
}

/* --------------------------
   Auto-resize for textareas
-------------------------- */
function autoResize(e) {
  const textArea = e.target;
  textArea.style.height = 'auto';
  textArea.style.height = textArea.scrollHeight + 'px';
}

/* --------------------------
   Build final summary
-------------------------- */
function buildSummary() {
  // Step 1: The Situation
  const situation = document.getElementById("situationInput")?.value.trim() || "(No situation provided)";

  // Step 2: The Feelings
  const feelings = [];
  for (let i = 1; i <= 3; i++) {
    const feeling = document.getElementById(`feelingSelect${i}`);
    const subFeeling = document.getElementById(`subFeelingSelect${i}`);
    if (feeling && !feeling.parentElement.classList.contains("hidden")) {
      const broad = feeling.value || "(None)";
      const sub = subFeeling.value || "(None)";
      feelings.push(`${broad}${sub !== "(None)" ? ` (${sub})` : ""}`);
    }
  }

  // Step 3: The Thoughts
  const thoughtsData = getAllThoughts();
  const thoughts = thoughtsData.length
    ? thoughtsData.map((t, i) => `#${i + 1}: ${t.thought} (Distress: ${t.distress})`).join("; ")
    : "(No thoughts provided)";

  // Step 4: Evaluate the Thought
  const distortions = getSelectedDistortions().join(", ") || "(None)";
  const evFor = getAllEvidenceFor()
    .map((e, i) => `#${i + 1}: ${e.text} (${e.rating || "-"})`)
    .join("; ") || "(None)";
  const evAgainst = getAllEvidenceAgainst()
    .map((e, i) => `#${i + 1}: ${e.text} (${e.rating || "-"})`)
    .join("; ") || "(None)";

  // Step 5: Make a Decision
  const accuracy = document.querySelector('input[name="accuracy"]:checked')?.value || "(Undecided)";
  const actionPlan = document.getElementById("newThought").value.trim() || "(No action plan provided)";

  // Final Summary
  return `
SITUATION: ${situation}
FEELINGS: ${feelings.join(", ") || "(None)"}
THOUGHTS: ${thoughts}
DISTORTIONS: ${distortions}
EVIDENCE FOR: ${evFor}
EVIDENCE AGAINST: ${evAgainst}
DECISION: ${accuracy}
ACTION PLAN: ${actionPlan}
  `.trim();
}

function openTab(evt, tabName) {
    // Declare all variables
    var i, tabcontent, tablinks;
  
    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }
  
    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
  
    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
  }
  
  document.getElementById("defaultOpen").click();

  async function deleteEntry(recordId) {
    // Use the browser's confirm dialog (you could also create a custom modal)
    if (!confirm("Are you sure you want to delete this entry? This action cannot be undone.")) {
      return;
    }
    
    try {
      await pb.collection("cognitive_restructures").delete(recordId);
      alert("Entry deleted successfully.");
      fetchPreviousResults(); // Refresh the list after deletion
    } catch (err) {
      alert("Error deleting entry: " + err.message);
    }
  }

  function closeResultModal() {
    document.getElementById("resultModal").style.display = "none";
  }
  

  window.onclick = function(event) {
    const modal = document.getElementById("resultModal");
    if (event.target == modal) {
      modal.style.display = "none";
    }
  }
  