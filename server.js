const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new Anthropic();

app.post('/api/meal-plan', async (req, res) => {
  const {
    age, heightFt, heightIn, heightCm, heightUnit,
    weight, weightUnit, sex,
    dietaryRestrictions, otherAllergies,
    fitnessGoal, activityLevel,
    cuisinePreferences, foodsToAvoid,
  } = req.body;

  const heightStr = heightUnit === 'imperial'
    ? `${heightFt} ft ${heightIn} in`
    : `${heightCm} cm`;

  const restrictions = [...(dietaryRestrictions || [])];
  if (otherAllergies) restrictions.push(otherAllergies);

  const prompt = `You are a professional nutritionist and meal planning expert. Create a detailed, personalized 7-day meal plan for this individual:

**Personal Profile:**
- Age: ${age} years
- Height: ${heightStr}
- Weight: ${weight} ${weightUnit}
- Sex: ${sex}

**Dietary Restrictions:** ${restrictions.length > 0 ? restrictions.join(', ') : 'None'}

**Fitness Goal:** ${fitnessGoal}

**Activity Level:** ${activityLevel}

**Cuisine Preferences:** ${cuisinePreferences || 'Open to all cuisines'}

**Foods to Avoid:** ${foodsToAvoid || 'None specified'}

Please provide a thorough response structured as follows:

## Nutritional Assessment
Brief assessment of their caloric and macronutrient targets based on their profile and goal.

## 7-Day Meal Plan
For each day (Day 1–7), list:
- **Breakfast** (with approximate calories and macros: protein/carbs/fat in grams)
- **Morning Snack**
- **Lunch** (with approximate calories and macros)
- **Afternoon Snack**
- **Dinner** (with approximate calories and macros)
- **Daily Total** (calories, protein, carbs, fat)

## Grocery Shopping List
Organized by category: Produce, Proteins, Grains & Legumes, Dairy/Alternatives, Pantry Staples.

## Meal Prep Tips
5 practical tips to make the week easier and stay on track.

Make meals varied, nutritious, flavorful, and realistic to prepare. Respect all dietary restrictions absolutely.`;

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Claude API error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate meal plan. Check your ANTHROPIC_API_KEY.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Meal planner running at http://localhost:${PORT}`);
});
