// Height unit toggle
function switchHeight(unit) {
  document.getElementById('height-imperial').classList.toggle('hidden', unit !== 'imperial');
  document.getElementById('height-metric').classList.toggle('hidden', unit !== 'metric');
  document.getElementById('heightUnit').value = unit;
  document.querySelectorAll('[data-unit]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.unit === unit);
  });
}

// Weight unit toggle
function switchWeight(unit) {
  document.getElementById('weightUnit').value = unit;
  document.getElementById('weight').placeholder = unit === 'lbs' ? 'e.g. 160' : 'e.g. 73';
  document.querySelectorAll('[data-wunit]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.wunit === unit);
  });
}

function showForm() {
  document.getElementById('meal-form').classList.remove('hidden');
  document.getElementById('results').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showResults() {
  document.getElementById('meal-form').classList.add('hidden');
  const results = document.getElementById('results');
  results.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('meal-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  // Basic validation
  const age = document.getElementById('age').value;
  const sex = document.getElementById('sex').value;
  const weight = document.getElementById('weight').value;
  const heightUnit = document.getElementById('heightUnit').value;

  if (!age || !sex || !weight) {
    alert('Please fill in age, sex, and weight.');
    return;
  }
  if (heightUnit === 'imperial' && !document.getElementById('heightFt').value) {
    alert('Please enter your height.');
    return;
  }
  if (heightUnit === 'metric' && !document.getElementById('heightCm').value) {
    alert('Please enter your height.');
    return;
  }
  if (!document.querySelector('input[name="fitnessGoal"]:checked')) {
    alert('Please select a fitness goal.');
    return;
  }
  if (!document.querySelector('input[name="activityLevel"]:checked')) {
    alert('Please select an activity level.');
    return;
  }

  // Gather form data
  const form = e.target;
  const formData = new FormData(form);

  const payload = {
    age: formData.get('age'),
    sex: formData.get('sex'),
    weight: formData.get('weight'),
    weightUnit: formData.get('weightUnit'),
    heightUnit: formData.get('heightUnit'),
    heightFt: formData.get('heightFt'),
    heightIn: formData.get('heightIn') || '0',
    heightCm: formData.get('heightCm'),
    dietaryRestrictions: formData.getAll('dietaryRestrictions'),
    otherAllergies: formData.get('otherAllergies'),
    fitnessGoal: formData.get('fitnessGoal'),
    activityLevel: formData.get('activityLevel'),
    cuisinePreferences: formData.get('cuisinePreferences'),
    foodsToAvoid: formData.get('foodsToAvoid'),
  };

  // Switch to results view
  showResults();
  document.getElementById('loading').classList.remove('hidden');
  const output = document.getElementById('meal-plan-output');
  const errorDiv = document.getElementById('error-msg');
  output.classList.add('hidden');
  errorDiv.classList.add('hidden');
  output.innerHTML = '';

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;

  let rawText = '';

  try {
    const response = await fetch('/api/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Server error');
    }

    document.getElementById('loading').classList.add('hidden');
    output.classList.remove('hidden');
    output.classList.add('cursor');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') {
          output.classList.remove('cursor');
          break;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) {
            rawText += parsed.text;
            output.innerHTML = marked.parse(rawText);
          }
        } catch (parseErr) {
          if (parseErr.message !== 'Unexpected end of JSON input') {
            throw parseErr;
          }
        }
      }
    }

    // Final render without cursor
    output.classList.remove('cursor');
    output.innerHTML = marked.parse(rawText);

  } catch (err) {
    document.getElementById('loading').classList.add('hidden');
    output.classList.add('hidden');
    errorDiv.classList.remove('hidden');
    errorDiv.textContent = `Error: ${err.message}. Make sure ANTHROPIC_API_KEY is set and the server is running.`;
  } finally {
    submitBtn.disabled = false;
  }
});
