let obsCount = 0;
let obsData = {};
let currentPhotoTarget = null;
let exportedPrompt = '';
const APPROVE_WEBHOOK_URL = 'https://studioinfinite.app.n8n.cloud/webhook/approve-report';
const REJECT_WEBHOOK_URL  = 'https://studioinfinite.app.n8n.cloud/webhook/reject-report';
let currentVisitId = null;
let pollInterval = null;
// Discipline checklists — add more disciplines here the same way (e.g. 'Brick Marking': [...])
const disciplineChecklists = {
  'Block Marking': [
    'Primary grid lines transferred correctly on site as per approved architectural drawings',
    'Grid-to-grid dimensions verified with the latest issued drawings (GFC / IFC)',
    'Block/tower footprint matches approved site layout and master plan',
    'Setbacks from plot boundaries as per approved sanction drawings',
    'Reference benchmarks (TBM) and datum levels identified and verified',
    'Building orientation and north alignment confirmed on site',
    'External wall lines and core walls marked accurately as per plans',
    'Column centrelines coordinated with architectural wall alignments',
    'Entry points, driveway edges, and access alignments marked as per drawings',
    'Plinth outline/building envelope marked correctly on the ground',
    'Staircase core, lift core, and service shaft positions marked as per architectural layouts',
    'Offsets, projections, and recesses are reflected correctly in block marking',
    'No clashes observed with site utilities, compound wall, or existing structures',
    'Levels coordinated with road levels, site grading, and plinth levels',
    'All dimensions cross-verified on site with control drawings',
    'Markings clearly visible, protected, and referenced for execution',
    'Any deviations from drawings recorded and highlighted to the client/PMC',
    'Block marking approved for proceeding with foundations / PCC / column starters (Architectural clearance)'
  ],
  'Brick Marking': [
    'Wall layout marked on slab as per latest approved architectural drawings (GFC/IFC)',
    'Internal and external wall thickness as per approved wall schedule',
    'Room sizes and clear internal dimensions verified as per plans',
    'Door and window openings marked at correct locations and widths',
    'Wall alignments coordinated with column faces and beam offsets',
    'Shaft walls, service ducts, and wet area partitions marked as per drawings',
    'Toilet, kitchen, and utility wall layouts match approved planning',
    'Balcony walls, parapets, and edge offsets marked correctly',
    'Lift lobby, staircase enclosure, and core wall positions marked correctly',
    'Wall offsets for architectural features (recesses, niches, projections) marked',
    'Tolerance from grid lines within acceptable architectural limits',
    'No clashes observed with MEP sleeves, floor traps, or shaft openings',
    'Provision for future finishes (plaster thickness, cladding build-up) considered',
    'Alignment continuity checked with floors below (vertical stacking of walls)',
    'Control lines and reference benchmarks clearly indicated on slab',
    'Markings are legible, protected, and approved for execution',
    'Deviations, if any, recorded and communicated to site/PMC',
    'Brick marking approved to proceed with masonry works (Architectural clearance)'
  ],
  'Finishes': [
    'Floor finishes (tiles / wood / stone) as per approved material and pattern',
    'Skirting type, height, and finish matching approved drawings',
    'Wall finishes (paint / wallpaper / veneer / panels) as per mockup',
    'Ceiling finish and level alignment maintained uniformly',
    'False ceiling details (profiles, grooves, shadow gaps) executed as approved',
    'Door shutters, frames, and hardware installed as per specification',
    'Window frames, shutters, and glass type as per approved sample',
    'Kitchen finishes (countertop, dado, shutters) as per design',
    'Wardrobe finishes, shutter alignment, and internal accessories',
    'Toilet finishes — wall & floor tiles, slope, and joint quality',
    'Sanitary fittings, CP fittings model and finish as approved',
    'Electrical fixtures (switches, sockets, plates) alignment and finish',
    'Light fixtures placement and finish matching lighting layout',
    'Joints, edges, and corner finishes executed neatly',
    'Finish transitions between materials handled properly',
    'No visible surface defects (cracks, stains, undulations)',
    'Mockup quality acceptable for replication in typical units'
  ],
  'Mivan Slab Check': [
    'Slab layout and dimensions match architectural drawings (plan / grid reference)',
    'Beam, column, and wall positions coordinated with architectural grid',
    'Slab openings (staircase, lift, ducts, shafts, skylight cut-outs) provided as per drawings',
    'Edge conditions and projections (balconies, sunshades, cornices) verified',
    'Slab thickness and drop panels (if any) marked and checked',
    'Alignment with previous slab / beam levels is accurate',
    'MEP provisions (conduits, sleeves, box-outs) coordinated with slab layout',
    'Rebar cover, placement, and spacing visually checked (architectural coordination)',
    'No conflicts observed with partition wall alignments or openings',
    'Formwork edges and shuttering lines are straight and clean',
    'Worksite cleanliness and safety measures are adequate',
    'Photographs taken for documentation'
  ],
  'Plinth Check Villas': [
    'Centreline and grid markings are correctly set out as per approved architectural drawings',
    'Plinth beam layout matches approved architectural and structural drawings',
    'Plinth beam width and depth conform to approved drawings',
    'Location of plinth beams aligns correctly with wall positions',
    'External and internal wall offsets are maintained as per drawings',
    'Finished plinth level (FPL) matches architectural specifications',
    'Plinth level relative to surrounding ground and site slope is as per design intent',
    'Door threshold levels and plinth cut-outs are provided as per drawings',
    'Provision for steps, ramps, and entrance levels coordinated with architectural drawings',
    'Service openings (plumbing sleeves, electrical conduits) provided at correct locations',
    'Plinth beam continuity at corners and junctions is properly detailed',
    'Alignment and straightness of plinth beam formwork checked',
    'Beam top level is uniform and within permissible tolerances',
    'No clashes observed between plinth beam and architectural elements',
    'Provision for damp proof course (DPC) level is clearly maintained',
    'Shuttering is properly fixed and cleaned prior to concreting',
    'All architectural requirements reviewed and approved before concrete pour'
  ],
  'Projection Slab Check': [
    'Grid lines are correctly marked and match approved architectural drawings',
    'Wall thickness and dimensions conform to architectural drawings',
    'Door and window opening sizes and locations are as per architectural drawings',
    'Alignment and plumb of vertical surfaces are accurate',
    'Floor-to-floor height matches architectural specifications',
    'Beam and slab edges align with architectural drawings',
    'Provision for architectural features (niches, offsets, design projections) is correctly incorporated',
    'Service shaft openings and ducts match architectural layouts',
    'Architectural cut-outs (AC ledge, balcony openings etc.) provided as per drawings',
    'Staircase dimensions (tread, riser, width) match approved drawings',
    'Lift lobby dimensions and openings conform with architectural plan',
    'Parapet and balcony edge details executed as per drawings',
    'All architectural tolerances (level, plumb, alignment) within acceptable limits',
    'Finish allowance (for plaster/finishes) maintained where required',
    'Architectural recesses for lighting or special features are provided',
    'Joint locations and construction joints do not clash with architectural elements',
    'Any design-related openings or architectural recesses are shuttered correctly before pour'
  ],
  'Ramp Check': [
    'Ramp location, alignment, and extents match approved architectural drawings',
    'Ramp slope / gradient as per drawings and local bye-laws (NBC)',
    'Clear ramp width maintained as per approved drawings',
    'Headroom clearance maintained throughout ramp length and turning zones',
    'Turning radii at ramp bends comply with vehicular movement requirements',
    'Entry and exit ramp levels coordinated with approach road and basement levels',
    'Ramp landings and transition zones provided as per drawings',
    'Kerbs / wheel stoppers / edge upstands provided as per architectural details',
    'Parapet walls / guard walls / crash barriers at ramp edges as per drawings',
    'Drainage slope and floor profile provided to avoid water stagnation',
    'Surface finish allowance (IPS / concrete topping / epoxy / chequered finish) considered',
    'No clash of ramp with parking bays, drive aisles, columns, or walls',
    'Signage zones, direction markings, and wayfinding provision accounted for',
    'Pedestrian safety zones / walkways (if any) along ramp edges provided',
    'Expansion / construction joints aligned without impacting architectural finish',
    'Adequate visibility at ramp entry/exit (no blind corners as per design intent)',
    'Ramp parapet height and handrail provision (if applicable) as per drawings',
    'Architectural tolerances (level, alignment, edge straightness) within limits',
    'Finish interfaces at ramp–basement floor junction coordinated',
    'All architectural openings, recesses, and edge profiles shuttered correctly before pour'
  ],
  'Slab Check Villas': [
    'Slab layout and extents match latest approved architectural drawings (GFC/IFC)',
    'Grid lines and control dimensions verified on shuttering',
    'Beam and slab edges aligned with architectural plans and sections',
    'Slab thickness and drop panels (if any) as per architectural coordination drawings',
    'Level of slab (FFL reference) coordinated with floor-to-floor heights',
    'Openings for stairs, lifts, shafts, and ducts provided as per drawings',
    'Balcony projections, cantilevers, and edge offsets as per architectural details',
    'AC ledges, service ledges, and architectural cut-outs formed correctly',
    'Parapet starter / upstand provisions at slab edges as per drawings',
    'Alignment continuity with lower floor walls and slab edges verified',
    'No clash of slab edges/openings with door thresholds and wall lines',
    'Provision for waterproofing build-up and finish thickness considered (where applicable)',
    'Construction joints located away from visible architectural edges (where feasible)',
    'Shuttering line straightness and edge quality acceptable for architectural finish',
    'Ramps / slab level changes coordinated with architectural sections (if applicable)',
    'Staircase landing levels coordinated with slab level',
    'Service sleeves / block-outs positioned without affecting architectural elements',
    'All architectural profiles, recesses, and special edge details formed prior to pour',
    'Tolerances in level and alignment within acceptable architectural limits',
    'Slab cleared for concreting from Architectural POV (subject to closure of remarks)'
  ],
  'Terrace Mivan': [
    'Grid lines and reference centrelines marked correctly as per approved architectural & structural drawings',
    'Terrace slab layout matches approved GFC drawings (overall dimensions and setbacks)',
    'Slab thickness and edge beam profiles as per approved drawings',
    'Parapet wall locations, thickness, and heights coordinated with drawings',
    'Upstand / kerb provisions at terrace edges and around openings provided as per details',
    'Staircase headroom and mumty/overrun slab levels as per architectural clearance requirements',
    'Lift machine room / lift overrun slab dimensions and access coordinated',
    'Shaft openings (lift, service shafts, ducts) located and sized as per GFC drawings',
    'Rainwater outlet (RWO) locations, diameters, and invert levels coordinated with plumbing drawings',
    'Terrace slope direction and level drops provided as per drainage design intent',
    'Provision for waterproofing upturns at parapets, shafts, and vertical elements',
    'Terrace finished floor level (FFL) benchmark marked and verified',
    'Services sleeves / embedded conduits (electrical earthing, lightning arrester, solar lines) provided at correct locations',
    'No clashes between slab edges, parapets, shafts, and architectural elements',
    'Alignment and straightness of MIVAN formwork for slab edges and parapets checked',
    'Edge shuttering properly fixed, cleaned, and sealed prior to concreting',
    'Tolerance check of slab top level and parapet base level within permissible limits',
    'Provision for future terrace elements (pergola, services platforms, solar structures, tanks if any) as per drawings',
    'Safety features (parapet height, temporary edge protection) ensured as per site safety norms',
    'All architectural requirements reviewed and approved before slab concrete pour'
  ],
  'Plumb & Fire': [
    'Plumbing and fire fighting layouts are set out as per approved drawings',
    'Sleeve locations for plumbing and fire fighting services are correctly positioned',
    'Pipe routing (vertical & horizontal) matches approved shop drawings',
    'Pipe diameters and material specifications as per approved BOQ / drawings',
    'Sanitary pipe slopes and gradients maintained correctly',
    'Floor trap, gully trap, and clean-out locations as per drawings',
    'Water supply pipe routing and pressure line provisions confirmed',
    'Fire fighting riser shaft size and location as per approved drawings',
    'Fire fighting pipe sleeves and openings coordinated with structure',
    'Position of valves (sluice, butterfly, NRV, control valves) as per drawings',
    'Location of fire hose reel, landing valve, and hydrant points verified',
    'Clearance maintained between plumbing, fire fighting, and structural elements',
    'Pipe supports, clamps, and hanger provisions planned correctly',
    'No clashes observed with architectural or structural elements',
    'Provision for waterproofing around pipe sleeves and cut-outs confirmed',
    'Concealed services coordinated with architectural finishes',
    'All required openings and block-outs provided before slab / wall casting'
  ]
};

let checklistAnswers = {};
let currentChecklistChip = null;

function toggleDisc(el) {
  const name = el.textContent.trim();
  if (disciplineChecklists[name]) {
    currentChecklistChip = el;
    openChecklist(name);
  } else {
    el.classList.toggle('active');
    updateSubmitState();
  }
}

function completeChecklist() {
  if (currentChecklistChip) {
    currentChecklistChip.classList.add('completed');
  }
  closeChecklist();
  updateDisciplineProgress();
  updateSubmitState();
}

function removeChecklist() {
  if (currentChecklistChip) {
    const name = currentChecklistChip.textContent.trim();
    delete checklistAnswers[name];
    currentChecklistChip.classList.remove('completed');
  }
  closeChecklist();
  updateDisciplineProgress();
  updateSubmitState();
}

function updateDisciplineProgress() {
  const badge = document.getElementById('disc-progress');
  if (!badge) return;
  const total = Object.keys(disciplineChecklists).length;
  const done = document.querySelectorAll('.disc-chip.completed').length;
  badge.textContent = done + ' / ' + total + ' checked';
}

function openChecklist(name) {
  const questions = disciplineChecklists[name];
  if (!questions) return;
  if (!checklistAnswers[name]) checklistAnswers[name] = {};

  document.getElementById('checklistTitle').textContent = name + ' — Checklist';
  const body = document.getElementById('checklistBody');
  body.innerHTML = questions.map((q, idx) => {
    if (!checklistAnswers[name][idx]) checklistAnswers[name][idx] = {};
    checklistAnswers[name][idx].question = q; // save question text alongside the index
    const saved = checklistAnswers[name][idx] || {};
    return `
      <div class="check-item">
        <p class="check-q">${idx + 1}. ${q}</p>
        <div class="check-yn">
          <button class="yn-btn ${saved.answer === 'Yes' ? 'active-yes' : ''}" onclick="setCheckAnswer('${name}', ${idx}, 'Yes', this)">Yes</button>
          <button class="yn-btn ${saved.answer === 'No' ? 'active-no' : ''}" onclick="setCheckAnswer('${name}', ${idx}, 'No', this)">No</button>
        </div>
        <input type="text" class="check-remarks" placeholder="Remarks (optional)" value="${saved.remarks || ''}" oninput="setCheckRemarks('${name}', ${idx}, this.value)">
      </div>
    `;
  }).join('');
  updateChecklistDoneState();
  document.getElementById('checklistModal').classList.add('open');
}


function closeChecklist() {
  document.getElementById('checklistModal').classList.remove('open');
}

function setCheckAnswer(name, idx, val, btn) {
  if (!checklistAnswers[name]) checklistAnswers[name] = {};
  if (!checklistAnswers[name][idx]) checklistAnswers[name][idx] = {};
  checklistAnswers[name][idx].answer = val;
  const row = btn.closest('.check-yn');
  row.querySelectorAll('.yn-btn').forEach(b => b.classList.remove('active-yes', 'active-no'));
  btn.classList.add(val === 'Yes' ? 'active-yes' : 'active-no');
    updateChecklistDoneState();
}

function setCheckRemarks(name, idx, val) {
  if (!checklistAnswers[name]) checklistAnswers[name] = {};
  if (!checklistAnswers[name][idx]) checklistAnswers[name][idx] = {};
  checklistAnswers[name][idx].remarks = val;
}
function updateChecklistDoneState() {
  const btn = document.getElementById('checklistDoneBtn');
  if (!btn || !currentChecklistChip) return;
  const name = currentChecklistChip.textContent.trim();
  const answers = checklistAnswers[name] || {};
  const anyAnswered = Object.values(answers).some(a => a && a.answer);
  btn.disabled = !anyAnswered;
}
function handleSubmit() {
  document.getElementById('confirmModal').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirmModal').classList.remove('open');
}

// --------------------------------------------------------------------------
// Supabase submission — uploads all observation photos to Storage, then
// inserts one row into the single "site_visits" table (checklist answers +
// observations, each with its uploaded photo URLs).
// --------------------------------------------------------------------------
const STORAGE_BUCKET = 'site-photos';

// Uploads every photo attached to one observation and returns their public URLs.
async function uploadObsPhotos(obsId) {
  const photos = (obsData[obsId] && obsData[obsId].photos) || [];
  const urls = [];
  for (const p of photos) {
    const safeName = p.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `obs-${obsId}/${Date.now()}-${safeName}`;
    const { error } = await supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .upload(path, p.file, { upsert: false });
    if (error) {
      console.error('Photo upload failed:', error);
      throw new Error('Photo upload failed: ' + error.message);
    }
    const { data: publicUrlData } = supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);
    urls.push(publicUrlData.publicUrl);
  }
  return urls;
}

// Uploads photos for every observation and returns the full observations array
// (ready to be stored as jsonb) with photo URLs instead of local file objects.
async function buildObservationsPayload() {
  const result = [];
  for (const id of Object.keys(obsData)) {
    const caption    = getVal('caption-' + id);
    const issue      = getVal('issue-' + id);
    const drw        = getVal('drw-' + id);
    const contractor = getVal('contractor-' + id);
    const action     = getVal('action-' + id);
    const owner      = getVal('owner-' + id);
    const target     = getVal('target-' + id);
    const status     = getVal('status-' + id);
    const resolution = getVal('resolution-' + id);
    const severity   = obsData[id] ? obsData[id].severity : '';

    const photoUrls = await uploadObsPhotos(id);

    result.push({
      element_location: caption,
      severity: severity,
      issue_description: issue,
      drawing_ref: drw,
      action_taken_by: contractor,
      action_required: action,
      action_owner: owner,
      target_date: target || null,
      obs_status: status,
      resolution_notes: resolution,
      photos: photoUrls
    });
  }
  return result;
}

function buildPayload(observationsPayload) {
  return {

    project_name: getVal('proj-name'),
    block_tower: getVal('block-tower'),
    location: getVal('location'),
    report_no: getVal('report-no'),
    project_no: getVal('project-no'),
    representative_client_name: getVal('rep-client'),
    representative_pmc_name: getVal('rep-pmc'),
    visit_date: getVal('visit-date') || null,
    visit_time: getVal('visit-time'),
    project_architect: getVal('project-architect'),
    project_coordinator: getVal('project-coordinator'),
    checklist_data: checklistAnswers,
    observations: observationsPayload,
    status: 'submitted'
  };
}

async function confirmSubmit() {
  closeConfirm();

  const btn = document.getElementById('submit-btn');
  const hint = document.getElementById('submit-hint');
  const originalBtnText = btn.textContent;

  btn.disabled = true;
  btn.textContent = 'Uploading photos & submitting...';
  if (hint) {
    hint.textContent = 'Please wait, do not close this page.';
    hint.classList.add('show');
  }

  try {
    if (!supabaseClient) throw new Error('Supabase client not initialized.');

    const observationsPayload = await buildObservationsPayload();
    const payload = buildPayload(observationsPayload);

    const { data: inserted, error } = await supabaseClient
      .from('site_visits')
      .insert([payload])
      .select('id');
    if (error) throw error;

    currentVisitId = inserted[0].id;
    startReportWait();

  } catch (err) {
    console.error('Submission failed:', err);
    alert('Submission failed: ' + (err.message || 'Unknown error') + '\nPlease check your connection and try again.');
    btn.disabled = false;
    btn.textContent = originalBtnText;
    if (hint) hint.textContent = 'Fill in all required fields to submit';
    updateSubmitState();
  }
}

// --------------------------------------------------------------------------
// Report wait / preview / approve / reject
// --------------------------------------------------------------------------
function startReportWait() {
  document.getElementById('reportOverlay').classList.add('open');
  document.getElementById('reportWaiting').style.display = 'flex';
  document.getElementById('reportReady').style.display = 'none';

  let fakeProgress = 5;
  updateProgressBar(fakeProgress);

  pollInterval = setInterval(async () => {
    // creep the fake progress up to 90% while we wait (never hits 100 until real data arrives)
    if (fakeProgress < 90) {
      fakeProgress += Math.random() * 6;
      updateProgressBar(Math.min(fakeProgress, 90));
    }

    try {
      const { data, error } = await supabaseClient
        .from('site_visits')
        .select('final_file_url, status')
        .eq('id', currentVisitId)
        .single();

      if (error) throw error;

      if (data && data.final_file_url) {
        clearInterval(pollInterval);
        updateProgressBar(100);
        setTimeout(() => showReportReady(data.final_file_url), 400);
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, 3000);
}

function updateProgressBar(pct) {
  const fill = document.getElementById('progressFill');
  const label = document.getElementById('progressPct');
  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = Math.round(pct) + '%';
}

function showReportReady(fileUrl) {
  document.getElementById('reportWaiting').style.display = 'none';
  document.getElementById('reportReady').style.display = 'flex';
  document.getElementById('reportFrame').src = fileUrl;
}

async function handleApprove() {
  const approveBtn = document.getElementById('approveBtn');
  const rejectBtn = document.getElementById('rejectBtn');
  approveBtn.disabled = true;
  rejectBtn.disabled = true;
  approveBtn.textContent = 'Approving...';

  try {
    const resp = await fetch(APPROVE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentVisitId })
    });
    if (!resp.ok) throw new Error('Approve request failed: ' + resp.status);

    alert('Report approved!');
    window.location.reload();

  } catch (err) {
    console.error('Approve failed:', err);
    alert('Could not approve the report: ' + err.message);
    approveBtn.disabled = false;
    rejectBtn.disabled = false;
    approveBtn.textContent = 'Approve';
  }
}

async function handleReject() {
  if (!confirm('This will permanently delete this submission and its photos. You will need to fill the form again. Continue?')) return;

  const approveBtn = document.getElementById('approveBtn');
  const rejectBtn = document.getElementById('rejectBtn');
  approveBtn.disabled = true;
  rejectBtn.disabled = true;
  rejectBtn.textContent = 'Rejecting...';

  try {
    const resp = await fetch(REJECT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentVisitId })
    });
    if (!resp.ok) throw new Error('Reject request failed: ' + resp.status);

    alert('Submission rejected and removed. Please fill the form again.');
    window.location.reload();

  } catch (err) {
    console.error('Reject failed:', err);
    alert('Could not reject the report: ' + err.message);
    approveBtn.disabled = false;
    rejectBtn.disabled = false;
    rejectBtn.textContent = 'Reject & Redo';
  }
}
function renderEmptyState() {
  const list = document.getElementById('obs-list');
  if (!list) return;
  if (obsCount === 0 || list.children.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-ico">&#128269;</span>
        <p>No observations added yet</p>
        <p class="sub">Tap "+ add observation" below to log the first issue</p>
      </div>
    `;
  }
}

function addObs() {
  const emptyEl = document.querySelector('#obs-list .empty-state');
  if (emptyEl) emptyEl.remove();

  obsCount++;
  const id = obsCount;
  obsData[id] = { severity: '', photos: [] };

  const div = document.createElement('div');
  div.className = 'obs-card';
  div.id = 'obs-' + id;
  div.innerHTML = `
    <div class="obs-card-hdr">
      <span class="obs-num"><span class="obs-dot"></span>Observation ${id}</span>
      <button class="obs-del" onclick="removeObs(${id})">&#x2715; remove</button>
    </div>
    <div class="obs-body">
      <div class="photo-drop" onclick="triggerPhoto(${id})" id="drop-${id}">
        <span class="ico">&#128247;</span>
        <p>Tap to add site photos</p>
        <p class="hint">You can select multiple at once</p>
      </div>
      <div class="photo-grid" id="preview-${id}"></div>
      <div class="field">
        <label>Element / location description</label>
        <input type="text" id="caption-${id}" placeholder="e.g. Slab formwork Level 4, Grid C–D / 3–4">
      </div>
      <div class="field" style="margin-bottom:6px"><label>Severity</label></div>
      <div class="sev-grid">
        <button class="sev-btn sev-critical" onclick="setSev(${id},'Critical',this)">
          <span class="dot"></span>Critical<span class="hint">stop work</span>
        </button>
        <button class="sev-btn sev-major" onclick="setSev(${id},'Major',this)">
          <span class="dot"></span>Major<span class="hint">next stage</span>
        </button>
        <button class="sev-btn sev-minor" onclick="setSev(${id},'Minor',this)">
          <span class="dot"></span>Minor<span class="hint">handover</span>
        </button>
        <button class="sev-btn sev-obs" onclick="setSev(${id},'Observation',this)">
          <span class="dot"></span>Observation<span class="hint">record</span>
        </button>
      </div>
            <div class="field">
        <label>Issue / observation (any language — rough notes fine)</label>
        <textarea id="issue-${id}" placeholder="Describe what was observed."></textarea>
      </div>
      <div class="sep"></div>
      <div class="field">
        <label>GFC / reference drawing no.</label>
        <input type="text" id="drw-${id}" placeholder="e.g. SI-C-2345-CD-BL-FP-002  or  NA">
      </div>
      <div class="field">
        <label>Action taken by</label>
        <input type="text" id="contractor-${id}" placeholder="Name of person">
      </div>
      <div class="field">
        <label>Action required</label>
        <textarea id="action-${id}" placeholder="What needs to be done..." style="min-height:60px"></textarea>
      </div>
      <div class="row-2">
        <div class="field">
          <label>Action owner</label>
          <input type="text" id="owner-${id}" placeholder="Role / name">
        </div>
        <div class="field">
          <label>Target completion date</label>
          <input type="date" id="target-${id}">
        </div>
      </div>
      <div class="field">
        <label>Status</label>
        <select id="status-${id}">
          <option value="Open">Open</option>
          <option value="In progress">In progress</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>
      <div class="field">
        <label>Resolution / follow-up notes</label>
        <textarea id="resolution-${id}" placeholder="What was agreed, done, or any outstanding items..." style="min-height:56px"></textarea>
      </div>
    </div>
  `;
    document.getElementById('obs-list').appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  updateSubmitState();
}

function removeObs(id) {
  const el = document.getElementById('obs-' + id);
  if (el) el.remove();
  delete obsData[id];
  renderEmptyState();
  updateSubmitState();
}

function triggerPhoto(id) {
  currentPhotoTarget = id;
  document.getElementById('photoSheet').classList.add('open');
}

function closePhotoSheet() {
  document.getElementById('photoSheet').classList.remove('open');
}
 
function choosePhotoSource(source) {
  closePhotoSheet();
  if (source === 'camera') {
    document.getElementById('file-input-camera').click();
  } else {
    document.getElementById('file-input-gallery').click();
  }
}

function handlePhotoFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length || !currentPhotoTarget) return;
  const id = currentPhotoTarget;
  if (!obsData[id]) return;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(ev) {
      obsData[id].photos.push({ file: file, name: file.name, dataUrl: ev.target.result });
      renderPhotoGrid(id);
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById('file-input-camera').addEventListener('change', function(e) {
  handlePhotoFiles(e.target.files);
  this.value = '';
});

document.getElementById('file-input-gallery').addEventListener('change', function(e) {
  handlePhotoFiles(e.target.files);
  this.value = '';
});

function renderPhotoGrid(id) {
  const grid = document.getElementById('preview-' + id);
  if (!grid || !obsData[id]) return;
  grid.innerHTML = obsData[id].photos.map((p, idx) => `
    <div class="photo-thumb">
      <img src="${p.dataUrl}" alt="Site photo" onclick="openLightbox('${p.dataUrl}')">
      <button class="thumb-clear" onclick="removePhoto(${id}, ${idx})">&#x2715;</button>
    </div>
  `).join('');
}

function removePhoto(id, index) {
  if (!obsData[id]) return;
  obsData[id].photos.splice(index, 1);
  renderPhotoGrid(id);
}

function openLightbox(url) {
  document.getElementById('lightbox-img').src = url;
  document.getElementById('lightbox').classList.add('open');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
}

function setSev(id, val, btn) {
  const card = document.getElementById('obs-' + id);
  card.querySelectorAll('.sev-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (obsData[id]) obsData[id].severity = val;
  updateSubmitState();
}
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

// --------------------------------------------------------------------------
// Form validation — Submit stays disabled until every required field is
// filled. Project Details are always required. Each observation, once
// added, brings its own required fields (element/location, severity,
// discipline, issue description, action required, action owner, target date).
// --------------------------------------------------------------------------
const REQUIRED_MAIN_FIELDS = [
  'proj-name', 'block-tower', 'location', 'report-no', 'project-no',
  'rep-client', 'rep-pmc', 'visit-date', 'visit-time', 'project-architect', 'project-coordinator'
];

function isObsValid(id) {
  const requiredIds = ['caption-' + id, 'issue-' + id, 'action-' + id, 'owner-' + id, 'target-' + id];
  for (const rid of requiredIds) {
    if (!getVal(rid)) return false;
  }
  if (!obsData[id] || !obsData[id].severity) return false;
  return true;
}

function isFormValid() {
  for (const rid of REQUIRED_MAIN_FIELDS) {
    if (!getVal(rid)) return false;
  }
  const anyDiscipline = document.querySelectorAll('.disc-chip.active, .disc-chip.completed').length > 0;
  if (!anyDiscipline) return false;
  for (const id of Object.keys(obsData)) {
    if (!isObsValid(id)) return false;
  }
  return true;
}

function updateSubmitState() {
  const btn = document.getElementById('submit-btn');
  const hint = document.getElementById('submit-hint');
  if (!btn) return;
  const valid = isFormValid();
  btn.disabled = !valid;
  if (hint) hint.classList.toggle('show', !valid);
}


REQUIRED_MAIN_FIELDS.forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', updateSubmitState);
    el.addEventListener('change', updateSubmitState);
  }
});

document.getElementById('obs-list').addEventListener('input', updateSubmitState);
document.getElementById('obs-list').addEventListener('change', updateSubmitState);

function copyPrompt() {
  if (!exportedPrompt) return;
  navigator.clipboard.writeText(exportedPrompt).then(() => {
    const btn = document.querySelector('.btn-copy');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy to clipboard'; }, 2000);
  }).catch(() => {
    const box = document.getElementById('prompt-box');
    box.select && box.select();
  });
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

document.getElementById('modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

updateDisciplineProgress();
renderEmptyState();
updateSubmitState();