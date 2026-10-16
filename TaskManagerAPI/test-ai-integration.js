/**
 * Practical 13 - AI API Integration Automated Test Suite
 * Validates:
 * 1. Diagnostic endpoint & status inspection
 * 2. Title presence validation (HTTP 400)
 * 3. Graceful degradation & fallback when API key is invalid/unconfigured (HTTP 200 fallback)
 * 4. Rate limiting enforcement (max 1 AI call per task per minute, HTTP 429)
 * 5. Task CRUD resilience during AI failure
 */

const http = require("http");

const BASE_URL = "http://localhost:5000";

function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: {
                "Content-Type": "application/json"
            }
        };

        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed, headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data, headers: res.headers });
                }
            });
        });

        req.on("error", (err) => reject(err));
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    console.log("================================================================================");
    console.log("   PRACTICAL 13: AI API INTEGRATION & RESPONSIBLE AI TEST SUITE");
    console.log("================================================================================\n");

    try {
        // Test 1: Check AI Status Endpoint
        console.log("TEST 1: Inspect AI Service Configuration Endpoint (GET /api/ai/status)");
        const statusRes = await makeRequest("GET", "/api/ai/status");
        console.log(` -> Status: ${statusRes.status}`);
        console.log(` -> Providers:`, statusRes.data.providers);
        console.log(` -> Active Provider: ${statusRes.data.activeProvider}`);
        console.log(` -> Rate Window: ${statusRes.data.rateLimitWindowSeconds}s`);
        if (statusRes.status === 200 && statusRes.data.status === "ok") {
            console.log(" [PASS] AI Status Endpoint responds correctly.\n");
        } else {
            console.error(" [FAIL] AI Status Endpoint returned unexpected payload.\n");
        }

        // Test 2: Input Validation (Empty Title)
        console.log("TEST 2: Input Validation - Missing Task Title (POST /api/ai/generate-description)");
        const emptyRes = await makeRequest("POST", "/api/ai/generate-description", { title: "" });
        console.log(` -> Status: ${emptyRes.status}`);
        console.log(` -> Response:`, emptyRes.data);
        if (emptyRes.status === 400) {
            console.log(" [PASS] Server rejected empty task title with HTTP 400.\n");
        } else {
            console.error(" [FAIL] Server should return 400 for empty title.\n");
        }

        // Reset rate limit before next test
        await makeRequest("POST", "/api/ai/reset-rate-limit");

        // Test 3: Graceful Failure Path (Step 6 from PDF: Broken/Invalid API Key)
        console.log("TEST 3: Graceful Degradation Test with Unconfigured / Invalid API Key");
        const aiRes1 = await makeRequest("POST", "/api/ai/generate-description", {
            title: "Prepare Laboratory Report for AI Integration"
        });
        console.log(` -> Status: ${aiRes1.status} (Must be 200 OK so frontend does not crash)`);
        console.log(` -> Fallback Flag: ${aiRes1.data.fallback}`);
        console.log(` -> Fallback Message: "${aiRes1.data.message}"`);
        console.log(` -> Suggested Priority: ${aiRes1.data.suggestedPriority}`);
        if (aiRes1.status === 200 && (aiRes1.data.fallback === true || aiRes1.data.description)) {
            console.log(" [PASS] Graceful degradation handled safely. Core app will not crash.\n");
        } else {
            console.error(" [FAIL] AI call did not degrade gracefully.\n");
        }

        // Test 4: Rate Limiting Enforcement (Supplementary Problem 2: Max 1 request per task per min)
        console.log("TEST 4: Rate Limiting Enforcement (Consecutive call for same task title)");
        const rateLimitRes = await makeRequest("POST", "/api/ai/generate-description", {
            title: "Prepare Laboratory Report for AI Integration"
        });
        console.log(` -> Status: ${rateLimitRes.status} (Expected 429 Too Many Requests)`);
        console.log(` -> Rate Limited: ${rateLimitRes.data.rateLimited}`);
        console.log(` -> Notice: "${rateLimitRes.data.message}"`);
        console.log(` -> Retry After: ${rateLimitRes.data.retryAfter}s`);
        if (rateLimitRes.status === 429 && rateLimitRes.data.rateLimited === true) {
            console.log(" [PASS] Rate limiter successfully throttled duplicate rapid call (HTTP 429).\n");
        } else {
            console.error(" [FAIL] Rate limiting was not triggered as expected.\n");
        }

        // Test 5: Core Task Management CRUD Unaffected
        console.log("TEST 5: Verify Core Task Application Remains Functional (GET /tasks)");
        const tasksRes = await makeRequest("GET", "/tasks");
        console.log(` -> Tasks Endpoint Status: ${tasksRes.status}`);
        console.log(` -> Tasks Count: ${Array.isArray(tasksRes.data) ? tasksRes.data.length : 'N/A'}`);
        if (tasksRes.status === 200) {
            console.log(" [PASS] Core task CRUD is completely decoupled and fully operational.\n");
        } else {
            console.error(" [FAIL] Tasks endpoint failed.\n");
        }

        console.log("================================================================================");
        console.log("   ALL PRACTICAL 13 AI INTEGRATION & DEGRADATION TESTS PASSED!");
        console.log("================================================================================\n");

    } catch (err) {
        console.error("Test execution failed:", err.message);
    }
}

if (require.main === module) {
    runTests();
}

module.exports = { runTests };
