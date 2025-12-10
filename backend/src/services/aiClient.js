import axios from 'axios';

// OpenRouter Configuration
// Free-tier models: meta-llama/llama-3.2-3b-instruct:free, meta-llama/llama-3.1-8b-instruct:free
// For better quality (paid): google/gemini-1.5-flash-latest, meta-llama/llama-3.3-70b-instruct
// Check available models at: https://openrouter.ai/models
const fallbackModel = 'meta-llama/llama-3.2-3b-instruct:free'; // Stable free-tier model
const alternativeFreeModels = [
  'meta-llama/llama-3.2-3b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemini-flash-1.5:free',
  'mistralai/mistral-7b-instruct:free',
  'qwen/qwen-2-7b-instruct:free'
];
const configuredModel = (process.env.AI_MODEL || '').trim() || fallbackModel;
const openRouterApiUrl = 'https://openrouter.ai/api/v1/chat/completions';
const apiTimeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 30_000);
const maxTokens = Number(process.env.OPENROUTER_MAX_TOKENS || 500);
const temperature = Number(process.env.OPENROUTER_TEMPERATURE || 0.7);

// Log configuration on module load
console.log('🤖 AI Client Configuration:');
console.log(`   Model: ${configuredModel}`);
console.log(`   API Key: ${process.env.OPENROUTER_API_KEY ? '✅ Set (' + process.env.OPENROUTER_API_KEY.substring(0, 10) + '...)' : '❌ Not set'}`);
console.log(`   Timeout: ${apiTimeoutMs}ms`);
console.log(`   Max Tokens: ${maxTokens}`);

const systemPrompt =
  'You are a concise blog writer specializing in B2B SaaS and open-source Web3 infrastructure topics. Return short markdown articles (<=250 words) with a title and a few paragraphs. Focus exclusively on topics related to B2B SaaS (product-led growth, customer success, pricing strategies, go-to-market, retention, etc.) or open-source Web3 infrastructure (blockchain networks, decentralized storage, smart contracts, DeFi protocols, DAOs, etc.).';

/**
 * Normalizes the response from OpenRouter API
 * OpenRouter follows OpenAI's chat completions format:
 * {
 *   "choices": [{
 *     "message": {
 *       "content": "generated text..."
 *     }
 *   }]
 * }
 */
function normalizeGeneratedText(response) {
  if (!response) return null;
  
  // Handle OpenAI-compatible format
  if (response.choices && Array.isArray(response.choices) && response.choices.length > 0) {
    const choice = response.choices[0];
    // Chat completions format
    if (choice.message && choice.message.content) {
      return choice.message.content;
    }
    // Completions format (legacy)
    if (choice.text) {
      return choice.text;
    }
  }
  
  // Fallback: try to extract text from various possible formats
  if (typeof response === 'string') return response;
  if (response.content) return response.content;
  if (response.text) return response.text;
  
  return null;
}

/**
 * Builds the request payload for OpenRouter's chat completions API
 * Uses OpenAI-compatible format with messages array
 */
function buildOpenRouterPayload(prompt, model) {
  return {
    model: model,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: maxTokens,
    temperature: temperature,
    top_p: 0.9
  };
}

/**
 * Formats HTTP errors for better logging
 */
function formatHttpError(err) {
  if (!err) return { error: 'Unknown error' };
  if (err.response) {
    return {
      status: err.response.status,
      data: err.response.data,
      message: err.response.data?.error?.message || err.message
    };
  }
  if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
    return { error: 'Request timed out' };
  }
  return { error: err.message || 'Unknown error' };
}

/**
 * Verifies the OpenRouter API token by making a simple request
 */
async function verifyToken(token) {
  try {
    // Try to get models list to verify token and show available free models
    const response = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${token}`,
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:4000',
        'X-Title': process.env.OPENROUTER_X_TITLE || 'Assimetria Challenge'
      },
      timeout: 5000
    });
    
    // Log available free models for debugging
    if (response.data?.data) {
      const freeModels = response.data.data
        .filter(m => m.id && m.id.includes(':free'))
        .map(m => m.id)
        .slice(0, 5); // Show first 5 free models
      
      if (freeModels.length > 0) {
        console.log(' OpenRouter token verified successfully');
        console.log(` Available free models: ${freeModels.join(', ')}`);
      } else {
        console.log(' OpenRouter token verified successfully');
        console.log(' No free models found in response. Check https://openrouter.ai/models for available models.');
      }
    } else {
      console.log(' OpenRouter token verified successfully');
    }
    
    return true;
  } catch (err) {
    if (err.response?.status === 401) {
      console.error(' OpenRouter token verification failed - invalid API key');
      return false;
    }
    // If verification fails for other reasons (network, etc.), continue anyway
    console.warn(' Could not verify OpenRouter token, but continuing...');
    return true;
  }
}

/**
 * Generates text using OpenRouter's API
 * Uses chat completions endpoint which is the recommended approach
 */
async function generateViaOpenRouter(prompt) {
  const token = process.env.OPENROUTER_API_KEY;
  if (!token) {
    console.warn('OPENROUTER_API_KEY not set; using deterministic fallback text.');
    return null;
  }

  // Verify token first (optional but helpful for debugging)
  const tokenValid = await verifyToken(token);
  if (!tokenValid) {
    console.error(' Token verification failed. Please check:');
    console.error('   1. API key is correctly set in backend/.env as OPENROUTER_API_KEY');
    console.error('   2. API key is valid at https://openrouter.ai/keys');
    console.error('   3. You have sufficient credits or are using a free-tier model');
    return null;
  }

  // Try configured model first, then alternative free models
  const modelsToTry = [configuredModel];
  
  // Add alternative free models if configured model is not in the list
  if (!alternativeFreeModels.includes(configuredModel)) {
    modelsToTry.push(...alternativeFreeModels);
  } else {
    // If configured model is a free model, try other free models as backup
    modelsToTry.push(...alternativeFreeModels.filter(m => m !== configuredModel));
  }
  
  // Remove duplicates
  const uniqueModels = [...new Set(modelsToTry)];
  console.log(`🔄 Will try ${uniqueModels.length} model(s): ${uniqueModels.join(', ')}`);

  let lastError = null;

  for (const model of uniqueModels) {
    try {
      const payload = buildOpenRouterPayload(prompt, model);
      
      console.log(` Attempting OpenRouter generation with model: ${model}`);
      
      const { data } = await axios.post(openRouterApiUrl, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:4000',
          'X-Title': process.env.OPENROUTER_X_TITLE || 'Assimetria Challenge'
        },
        timeout: apiTimeoutMs
      });

      const text = normalizeGeneratedText(data);
      if (text) {
        console.log(`✅ OpenRouter generation succeeded with model: ${model}`);
        return text;
      } else {
        console.warn(`⚠️ OpenRouter returned data but couldn't extract text. Response structure:`, JSON.stringify(data).slice(0, 500));
        console.warn(`Full response keys:`, Object.keys(data || {}));
      }
    } catch (err) {
      const errorInfo = formatHttpError(err);
      const status = errorInfo.status;
      
      lastError = err;
      
      if (status === 401) {
        console.error(' Authentication failed - check your OPENROUTER_API_KEY');
        console.error('Error details:', errorInfo.data);
        // Don't try other models if auth fails
        break;
      } else if (status === 429) {
        console.warn(`⚠️ Rate limit exceeded for model ${model}. This may be due to:`);
        console.warn('   - Free tier daily limit (50 requests/day without credits)');
        console.warn('   - Too many requests in a short time');
        // Continue to try fallback model
      } else if (status === 400) {
        console.error(` Bad request for model ${model}:`, errorInfo.message);
        // Model might not exist or have wrong format, try next
      } else if (status === 404) {
        console.error(` Model ${model} not found or not available`);
        // Try next model
      } else {
        console.error(` OpenRouter API call failed for model ${model}:`, {
          status,
          error: errorInfo.message || errorInfo.error
        });
      }
    }
  }

  if (lastError) {
    const errorInfo = formatHttpError(lastError);
    console.error('❌ All OpenRouter attempts failed. Last error:', errorInfo.message || errorInfo.error);
    console.error('Status code:', errorInfo.status);
    if (errorInfo.data) {
      console.error('Error response data:', JSON.stringify(errorInfo.data, null, 2));
    }
    console.error('Troubleshooting tips:');
    console.error('   1. Verify your API key at https://openrouter.ai/keys');
    console.error('   2. Check available models at https://openrouter.ai/models');
    console.error('   3. Free-tier models require :free suffix (e.g., meta-llama/llama-3.2-3b-instruct:free)');
    console.error('   4. Check rate limits: 50/day free, 1000/day with 10+ credits');
    console.error('   5. Model availability may change - check OpenRouter docs for current free models');
    console.error('   6. Run GET /api/articles/diagnostics/ai to get detailed diagnostics');
  }

  return null;
}

/**
 * Generates a fallback article when AI generation fails
 */
function generateFallback(topic) {
  const paragraphs = [
    `In today's fast-paced landscape, ${topic} continues to shape how teams deliver value.`,
    `Practitioners emphasize iterative learning, pragmatic tooling, and measurable outcomes as the best path to sustainable progress.`,
    `Looking ahead, expect lightweight automation, sensible defaults, and a human-first perspective to remain central to successful ${topic} initiatives.`
  ];
  return {
    title: `Fallback article on ${topic}`,
    content: paragraphs.join('\n\n')
  };
}

/**
 * Test function to diagnose OpenRouter connection issues
 * Returns diagnostic information about API key, model availability, etc.
 */
export async function testOpenRouterConnection() {
  const token = process.env.OPENROUTER_API_KEY;
  const diagnostics = {
    hasApiKey: !!token,
    apiKeyLength: token ? token.length : 0,
    configuredModel: configuredModel,
    fallbackModel: fallbackModel,
    errors: [],
    warnings: [],
    success: false
  };

  if (!token) {
    diagnostics.errors.push('OPENROUTER_API_KEY is not set');
    return diagnostics;
  }

  // Test token verification
  try {
    const response = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${token}`,
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:4000',
        'X-Title': process.env.OPENROUTER_X_TITLE || 'Assimetria Challenge'
      },
      timeout: 10000
    });

    if (response.data?.data) {
      const freeModels = response.data.data
        .filter(m => m.id && m.id.includes(':free'))
        .map(m => m.id);
      
      diagnostics.availableFreeModels = freeModels.slice(0, 10);
      diagnostics.modelCount = freeModels.length;
      
      // Check if configured model is available
      const modelAvailable = freeModels.some(m => m === configuredModel);
      if (!modelAvailable) {
        diagnostics.warnings.push(`Configured model "${configuredModel}" not found in available free models`);
      }
    }
  } catch (err) {
    if (err.response?.status === 401) {
      diagnostics.errors.push('API key is invalid (401 Unauthorized)');
    } else {
      diagnostics.errors.push(`Failed to verify API key: ${err.message}`);
    }
    return diagnostics;
  }

  // Test actual generation
  try {
    const testPrompt = 'Say "test" in one word.';
    const payload = buildOpenRouterPayload(testPrompt, configuredModel);
    
    const { data } = await axios.post(openRouterApiUrl, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:4000',
        'X-Title': process.env.OPENROUTER_X_TITLE || 'Assimetria Challenge'
      },
      timeout: apiTimeoutMs
    });

    const text = normalizeGeneratedText(data);
    if (text) {
      diagnostics.success = true;
      diagnostics.testResponse = text.substring(0, 100);
    } else {
      diagnostics.errors.push('API returned data but could not extract text');
      diagnostics.rawResponse = JSON.stringify(data).substring(0, 200);
    }
  } catch (err) {
    const errorInfo = formatHttpError(err);
    diagnostics.errors.push(`Generation test failed: ${errorInfo.message || errorInfo.error}`);
    diagnostics.statusCode = errorInfo.status;
    diagnostics.errorDetails = errorInfo.data;
  }

  return diagnostics;
}

/**
 * Main function to generate an article about a given topic
 * Uses OpenRouter API, falls back to deterministic text if API fails
 */
export async function generateArticle(topic) {
  console.log(`📝 Generating article about: "${topic}"`);
  try {
    const prompt = `Write a concise blog post about "${topic}". The article must focus on B2B SaaS or open-source Web3 infrastructure topics. Include a clear title followed by 2-4 short paragraphs. Do not write about general engineering productivity, software development practices, or generic tech topics - only B2B SaaS or Web3 infrastructure.`;
    const llmResult = await generateViaOpenRouter(prompt);

    if (llmResult) {
      // Parse the generated text to extract title and content
      const lines = llmResult.trim().split('\n').filter(Boolean);
      let titleLine = lines[0] || '';
      
      // Remove markdown headers from title
      titleLine = titleLine.replace(/^#+\s*/, '').trim();
      
      // Extract title (first line, max 140 chars)
      const title = titleLine.slice(0, 140) || `New article on ${topic}`;
      
      // Rest is content
      const contentLines = lines.slice(1);
      const content = contentLines.length > 0 
        ? contentLines.join('\n').trim() 
        : llmResult.trim();
      
      return { title, content };
    }

    // Always return fallback if OpenRouter fails
    console.warn(`⚠️ Using fallback article for topic: "${topic}"`);
    return generateFallback(topic);
  } catch (err) {
    console.error('❌ Error generating article:', err);
    console.error('Stack:', err.stack);
    // Ensure we always return something, even on error
    return generateFallback(topic);
  }
}
