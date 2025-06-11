// agent/guardrails/projectTopics.js
// Guardrail to keep conversations focused on design and project topics

const FORBIDDEN_TOPICS = require('../config/forbiddenTopics');

function createProjectFocusedTopicsGuardrail() {
  return {
    name: 'project‑focused‑topics',
    async check({ content }) {
      const lower = content.toLowerCase();
      const hit = FORBIDDEN_TOPICS.some((topic) => lower.includes(topic));
      
      if (hit) {
        return {
          success: false,
          message:
            "I'm a Project Assistant focused on helping you create amazing designs and manage your projects. Let's talk about your creative projects instead! What would you like to create today?",
        };
      }
      
      return { success: true };
    },
  };
}

module.exports = { createProjectFocusedTopicsGuardrail };
