# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.2
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

### Adapter-Specific Context
- **Adapter Name**: ioBroker.plex
- **Primary Function**: Integration of Plex Media Server and Tautulli into ioBroker ecosystem
- **Key Dependencies**: 
  - `plex-api`: JavaScript library for Plex Media Server API communication
  - `tautulli-api`: Integration with Tautulli monitoring service
  - `axios`: HTTP client for API requests
  - `express`: Web server for webhook handling
  - `body-parser` & `multer`: Request parsing middleware
  - `fast-xml-parser` & `xml2js`: XML parsing for Plex API responses
- **Configuration Requirements**: 
  - Plex server connection settings (IP, port, token)
  - Optional Tautulli integration settings
  - Webhook configuration for real-time events
  - Media library and player configuration
- **Unique Architecture**:
  - Webhook receiver for Plex events (requires Express server setup)
  - API polling for status updates when webhooks unavailable
  - Complex nested state structure for media libraries, players, and content
  - Support for both local and remote Plex server connections

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();

                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        // Get all states created by adapter
                        const stateIds = await harness.dbConnection.getStateIDs('your-adapter.0.*');
                        
                        console.log(`📊 Found ${stateIds.length} states`);

                        if (stateIds.length > 0) {
                            console.log('✅ Adapter successfully created states');
                            
                            // Show sample of created states
                            const allStates = await new Promise((res, rej) => {
                                harness.states.getStates(stateIds, (err, states) => {
                                    if (err) return rej(err);
                                    res(states || []);
                                });
                            });
                            
                            console.log('📋 Sample states created:');
                            stateIds.slice(0, 5).forEach((stateId, index) => {
                                const state = allStates[index];
                                console.log(`   ${stateId}: ${state && state.val !== undefined ? state.val : 'undefined'}`);
                            });
                            
                            await harness.stopAdapter();
                            resolve(true);
                        } else {
                            console.log('❌ No states were created by the adapter');
                            reject(new Error('Adapter did not create any states'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            }).timeout(40000);
        });
    }
});
```

#### Testing Both Success AND Failure Scenarios

**IMPORTANT**: For every "it works" test, implement corresponding "it doesn't work and fails" tests. This ensures proper error handling and validates that your adapter fails gracefully when expected.

```javascript
// Example: Testing successful configuration
it('should configure and start adapter with valid configuration', function () {
    return new Promise(async (resolve, reject) => {
        // ... successful configuration test as shown above
    });
}).timeout(40000);

// Example: Testing failure scenarios
it('should NOT create daily states when daily is disabled', function () {
    return new Promise(async (resolve, reject) => {
        try {
            harness = getHarness();
            
            console.log('🔍 Step 1: Fetching adapter object...');
            const obj = await new Promise((res, rej) => {
                harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                    if (err) return rej(err);
                    res(o);
                });
            });
            
            if (!obj) return reject(new Error('Adapter object not found'));
            console.log('✅ Step 1.5: Adapter object loaded');

            console.log('🔍 Step 2: Updating adapter config...');
            Object.assign(obj.native, {
                position: TEST_COORDINATES,
                createCurrently: false,
                createHourly: true,
                createDaily: false, // Daily disabled for this test
            });

            await new Promise((res, rej) => {
                harness.objects.setObject(obj._id, obj, (err) => {
                    if (err) return rej(err);
                    console.log('✅ Step 2.5: Adapter object updated');
                    res(undefined);
                });
            });

            console.log('🔍 Step 3: Starting adapter...');
            await harness.startAdapterAndWait();
            console.log('✅ Step 4: Adapter started');

            console.log('⏳ Step 5: Waiting 20 seconds for states...');
            await new Promise((res) => setTimeout(res, 20000));

            console.log('🔍 Step 6: Fetching state IDs...');
            const stateIds = await harness.dbConnection.getStateIDs('your-adapter.0.*');

            console.log(`📊 Step 7: Found ${stateIds.length} total states`);

            const hourlyStates = stateIds.filter((key) => key.includes('hourly'));
            if (hourlyStates.length > 0) {
                console.log(`✅ Step 8: Correctly ${hourlyStates.length} hourly weather states created`);
            } else {
                console.log('❌ Step 8: No hourly states created (test failed)');
                return reject(new Error('Expected hourly states but found none'));
            }

            // Check daily states should NOT be present
            const dailyStates = stateIds.filter((key) => key.includes('daily'));
            if (dailyStates.length === 0) {
                console.log(`✅ Step 9: No daily states found as expected`);
            } else {
                console.log(`❌ Step 9: Daily states present (${dailyStates.length}) (test failed)`);
                return reject(new Error('Expected no daily states but found some'));
            }

            await harness.stopAdapter();
            console.log('🛑 Step 10: Adapter stopped');

            resolve(true);
        } catch (error) {
            reject(error);
        }
    });
}).timeout(40000);

// Example: Testing missing required configuration  
it('should handle missing required configuration properly', function () {
    return new Promise(async (resolve, reject) => {
        try {
            harness = getHarness();
            
            console.log('🔍 Step 1: Fetching adapter object...');
            const obj = await new Promise((res, rej) => {
                harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                    if (err) return rej(err);
                    res(o);
                });
            });
            
            if (!obj) return reject(new Error('Adapter object not found'));

            console.log('🔍 Step 2: Removing required configuration...');
            // Remove required configuration to test failure handling
            delete obj.native.position; // This should cause failure or graceful handling

            await new Promise((res, rej) => {
                harness.objects.setObject(obj._id, obj, (err) => {
                    if (err) return rej(err);
                    res(undefined);
                });
            });

            console.log('🔍 Step 3: Starting adapter...');
            await harness.startAdapterAndWait();

            console.log('⏳ Step 4: Waiting for adapter to process...');
            await new Promise((res) => setTimeout(res, 10000));

            console.log('🔍 Step 5: Checking adapter behavior...');
            const stateIds = await harness.dbConnection.getStateIDs('your-adapter.0.*');

            // Check if adapter handled missing configuration gracefully
            if (stateIds.length === 0) {
                console.log('✅ Adapter properly handled missing configuration - no invalid states created');
                resolve(true);
            } else {
                console.log('❌ Adapter created states despite missing required config');
                reject(new Error('Expected no states with missing config'));
            }
            
            await harness.stopAdapter();
        } catch (error) {
            // Error during startup is acceptable for missing config
            console.log('✅ Adapter properly failed with missing configuration');
            resolve(true);
        }
    });
}).timeout(40000);
```

Integration tests should run ONLY after lint and adapter tests pass:

```yaml
integration-tests:
  needs: [check-and-lint, adapter-tests]
  runs-on: ubuntu-latest
  steps:
    - name: Run integration tests
      run: npx mocha test/integration-*.js --exit
```

#### What NOT to Do
❌ Direct API testing: `axios.get('https://api.example.com')`
❌ Mock adapters: `new MockAdapter()`  
❌ Direct internet calls in tests
❌ Bypassing the harness system

#### What TO Do
✅ Use `@iobroker/testing` framework
✅ Configure via `harness.objects.setObject()`
✅ Start via `harness.startAdapterAndWait()`
✅ Test complete adapter lifecycle
✅ Verify states via `harness.states.getState()`
✅ Allow proper timeouts for async operations

### API Testing with Credentials
For adapters that connect to external APIs requiring authentication, implement comprehensive credential testing:

#### Password Encryption for Integration Tests
When creating integration tests that need encrypted passwords (like those marked as `encryptedNative` in io-package.json):

1. **Read system secret**: Use `harness.objects.getObjectAsync("system.config")` to get `obj.native.secret`
2. **Apply XOR encryption**: Implement the encryption algorithm:
   ```javascript
   async function encryptPassword(harness, password) {
       const systemConfig = await harness.objects.getObjectAsync("system.config");
       if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
           throw new Error("Could not retrieve system secret for password encryption");
       }
       
       const secret = systemConfig.native.secret;
       let result = '';
       for (let i = 0; i < password.length; ++i) {
           result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
       }
       return result;
   }
   ```
3. **Store encrypted password**: Set the encrypted result in adapter config, not the plain text
4. **Result**: Adapter will properly decrypt and use credentials, enabling full API connectivity testing

#### Demo Credentials Testing Pattern
- Use provider demo credentials when available (e.g., `demo@api-provider.com` / `demo`)
- Create separate test file (e.g., `test/integration-demo.js`) for credential-based tests
- Add npm script: `"test:integration-demo": "mocha test/integration-demo --exit"`
- Implement clear success/failure criteria with recognizable log messages
- Expected success pattern: Look for specific adapter initialization messages
- Test should fail clearly with actionable error messages for debugging

#### Enhanced Test Failure Handling
```javascript
it("Should connect to API with demo credentials", async () => {
    // ... setup and encryption logic ...
    
    const connectionState = await harness.states.getStateAsync("adapter.0.info.connection");
    
    if (connectionState && connectionState.val === true) {
        console.log("✅ SUCCESS: API connection established");
        return true;
    } else {
        throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
            "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
    }
}).timeout(120000); // Extended timeout for API calls
```

### Plex-Specific Testing Considerations
- Mock Plex API responses using example data from actual Plex servers
- Test webhook handling with simulated Plex events
- Verify media state parsing for various content types (movies, TV shows, music)
- Test player control functionality (play, pause, stop, seek)
- Validate library scanning and state structure creation
- Test both authenticated and unauthenticated scenarios

## Code Structure

### ioBroker Adapter Structure
```
/
├── main.js or [adapterName].js  # Main adapter entry point
├── io-package.json             # Adapter metadata and configuration
├── package.json               # Node.js package definition
├── admin/                     # Admin interface files
│   ├── index_m.html          # Main admin page
│   ├── jsonConfig.json       # JSON-based configuration (newer adapters)
│   └── words.js              # Translations
├── lib/                      # Helper libraries and modules
├── test/                     # Test files
└── www/                      # Web interface files (if applicable)
```

### Key Files in This Repository
- `plex.js`: Main adapter implementation with Plex API integration
- `lib/`: Helper modules for API communication and data processing
- `admin/`: Configuration interface for Plex server settings
- `_ACTIONS.json`, `_EVENTS.js`, `_NODES.json`: Plex-specific data structures and events
- `README-states.md`, `README-tautulli.md`: Documentation for states and Tautulli integration

## State Management

### State Naming Convention
- Use dot notation for hierarchical states: `device.channel.state`
- Keep state names descriptive but concise
- Use lowercase with underscores for multi-word states
- Example: `servers.main.libraries.movies.recently_added`

### State Types and Roles
- Use appropriate state types (boolean, number, string, object)
- Set correct roles for UI display (indicator, level, switch, etc.)
- Include proper units where applicable
- Example state definition:
  ```javascript
  await this.setObjectNotExistsAsync('players.living_room.progress', {
    type: 'state',
    common: {
      name: 'Playback Progress',
      type: 'number',
      role: 'value.progress',
      min: 0,
      max: 100,
      unit: '%',
      read: true,
      write: false
    },
    native: {}
  });
  ```

### Plex-Specific State Structure
- `servers`: Plex server information and status
- `libraries`: Media libraries (movies, TV shows, music, etc.)
- `players`: Active players and their current status
- `webhooks`: Webhook-received events and data
- `tautulli`: Optional Tautulli integration states (if configured)

## Configuration

### Admin Interface
- Use JSON Config format for modern adapters (jsonConfig.json)
- Provide clear descriptions and help text
- Group related settings logically
- Validate input data before saving
- Example JSON config structure:
  ```json
  {
    "type": "tabs",
    "items": {
      "connection": {
        "type": "panel",
        "label": "Connection Settings",
        "items": {
          "server_ip": {
            "type": "text",
            "label": "Plex Server IP",
            "help": "IP address of your Plex Media Server"
          }
        }
      }
    }
  }
  ```

### Configuration Validation
- Validate all user inputs before using them
- Provide meaningful error messages
- Test connections during adapter startup
- Handle missing or invalid configurations gracefully

## README Updates

### Required Sections
When updating README.md files, ensure these sections are present and well-documented:

1. **Installation** - Clear npm/ioBroker admin installation steps
2. **Configuration** - Detailed configuration options with examples
3. **Usage** - Practical examples and use cases
4. **Changelog** - Version history and changes (use "## **WORK IN PROGRESS**" section for ongoing changes following AlCalzone release-script standard)
5. **License** - License information (typically MIT for ioBroker adapters)
6. **Support** - Links to issues, discussions, and community support

### Documentation Standards
- Use clear, concise language
- Include code examples for configuration
- Add screenshots for admin interface when applicable
- Maintain multilingual support (at minimum English and German)
- When creating PRs, add entries to README under "## **WORK IN PROGRESS**" section following ioBroker release script standard
- Always reference related issues in commits and PR descriptions (e.g., "solves #xx" or "fixes #xx")

### Mandatory README Updates for PRs
For **every PR or new feature**, always add a user-friendly entry to README.md:

- Add entries under `## **WORK IN PROGRESS**` section before committing
- Use format: `* (author) **TYPE**: Description of user-visible change`
- Types: **NEW** (features), **FIXED** (bugs), **ENHANCED** (improvements), **TESTING** (test additions), **CI/CD** (automation)
- Focus on user impact, not technical implementation details
- Example: `* (DutchmanNL) **FIXED**: Adapter now properly validates login credentials instead of always showing "credentials missing"`

### Changelog Management with AlCalzone Release-Script
Follow the [AlCalzone release-script](https://github.com/AlCalzone/release-script) standard for changelog management:

#### Format Requirements
- Always use `## **WORK IN PROGRESS**` as the placeholder for new changes
- Add all PR/commit changes under this section until ready for release
- Never modify version numbers manually - only when merging to main branch
- Maintain this format in README.md or CHANGELOG.md:

```markdown
# Changelog

<!--
  Placeholder for the next version (at the beginning of the line):
  ## **WORK IN PROGRESS**
-->

## **WORK IN PROGRESS**

-   Did some changes
-   Did some more changes

## v0.1.0 (2023-01-01)
Initial release
```

#### Workflow Process
- **During Development**: All changes go under `## **WORK IN PROGRESS**`
- **For Every PR**: Add user-facing changes to the WORK IN PROGRESS section
- **Before Merge**: Version number and date are only added when merging to main
- **Release Process**: The release-script automatically converts the placeholder to the actual version

#### Change Entry Format
Use this consistent format for changelog entries:
- `- (author) **TYPE**: User-friendly description of the change`
- Types: **NEW** (features), **FIXED** (bugs), **ENHANCED** (improvements)
- Focus on user impact, not technical implementation details
- Reference related issues: "fixes #XX" or "solves #XX"

#### Example Entry
```markdown
## **WORK IN PROGRESS**

- (DutchmanNL) **FIXED**: Adapter now properly validates login credentials instead of always showing "credentials missing" (fixes #25)
- (DutchmanNL) **NEW**: Added support for device discovery to simplify initial setup
```

## Dependency Updates

### Package Management
- Always use `npm` for dependency management in ioBroker adapters
- When working on new features in a repository with an existing package-lock.json file, use `npm ci` to install dependencies. Use `npm install` only when adding or updating dependencies.
- Keep dependencies minimal and focused
- Only update dependencies to latest stable versions when necessary or in separate Pull Requests. Avoid updating dependencies when adding features that don't require these updates.
- When you modify `package.json`:
  1. Run `npm install` to update and sync `package-lock.json`.
  2. If `package-lock.json` was updated, commit both `package.json` and `package-lock.json`.

### Dependency Best Practices
- Prefer built-in Node.js modules when possible
- Use `@iobroker/adapter-core` for adapter base functionality
- Avoid deprecated packages
- Document any specific version requirements

## JSON-Config Admin Instructions

### Configuration Schema
When creating admin configuration interfaces:

- Use JSON-Config format for modern ioBroker admin interfaces
- Provide clear labels and help text for all configuration options
- Include input validation and error messages
- Group related settings logically
- Example structure:
  ```json
  {
    "type": "panel",
    "items": {
      "host": {
        "type": "text",
        "label": "Host address",
        "help": "IP address or hostname of the device"
      }
    }
  }
  ```

### Admin Interface Guidelines
- Use consistent naming conventions
- Provide sensible default values
- Include validation for required fields
- Add tooltips for complex configuration options
- Ensure translations are available for all supported languages (minimum English and German)
- Write end-user friendly labels and descriptions, avoiding technical jargon where possible

## Best Practices for Dependencies

### HTTP Client Libraries
- **Preferred:** Use native `fetch` API (Node.js 20+ required for adapters; built-in since Node.js 18)
- **Note for this adapter:** This adapter currently uses `axios` for HTTP requests due to existing implementation and specific features required for Plex API integration

### Example with fetch:
```javascript
try {
  const response = await fetch('https://api.example.com/data');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
} catch (error) {
  this.log.error(`API request failed: ${error.message}`);
}
```

### Other Dependency Recommendations
- **Logging:** Use adapter built-in logging (`this.log.*`)
- **Scheduling:** Use adapter built-in timers and intervals
- **File operations:** Use Node.js `fs/promises` for async file operations
- **Configuration:** Use adapter config system rather than external config libraries

## Error Handling

### General Principles
- Always use try-catch blocks for async operations
- Log errors with appropriate severity levels
- Provide user-friendly error messages
- Implement retry logic for transient failures
- Clean up resources properly on errors

### ioBroker Logging
```javascript
this.log.error('Critical error message');
this.log.warn('Warning message');
this.log.info('Information message');
this.log.debug('Debug message (only in debug mode)');
this.log.silly('Verbose debug information');
```

### Adapter Error Patterns
- Always catch and log errors appropriately
- Use adapter log levels (error, warn, info, debug)
- Provide meaningful, user-friendly error messages that help users understand what went wrong
- Handle network failures gracefully
- Implement retry mechanisms where appropriate
- Always clean up timers, intervals, and other resources in the `unload()` method

### Example Error Handling:
```javascript
try {
  await this.connectToDevice();
} catch (error) {
  this.log.error(`Failed to connect to device: ${error.message}`);
  this.setState('info.connection', false, true);
  // Implement retry logic if needed
}
```

### Timer and Resource Cleanup:
```javascript
// In your adapter class
private connectionTimer?: NodeJS.Timeout;

async onReady() {
  this.connectionTimer = setInterval(() => {
    this.checkConnection();
  }, 30000);
}

onUnload(callback) {
  try {
    // Clean up timers and intervals
    if (this.connectionTimer) {
      clearInterval(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    // Close connections, clean up resources
    callback();
  } catch (e) {
    callback();
  }
}
```

### Plex-Specific Error Handling
- Handle Plex server connection failures gracefully
- Retry API calls with exponential backoff
- Validate Plex API responses before processing
- Handle authentication errors (invalid tokens, expired sessions)
- Manage webhook connectivity issues

## API Integration

### HTTP Client Best Practices
- Use axios for HTTP requests with proper error handling
- Implement request timeouts
- Add retry logic for failed requests
- Use proper HTTP methods (GET, POST, PUT, DELETE)
- Handle rate limiting from external APIs

### Plex API Integration
- Use the official `plex-api` library when possible
- Handle XML responses from older Plex API endpoints
- Implement proper authentication (X-Plex-Token header)
- Cache API responses when appropriate to reduce server load
- Handle different Plex server versions and capabilities

### Example API Request
```javascript
async makeApiRequest(endpoint) {
  try {
    const response = await axios.get(`${this.config.serverUrl}${endpoint}`, {
      headers: {
        'X-Plex-Token': this.config.token,
        'Accept': 'application/json'
      },
      timeout: 5000
    });
    
    return response.data;
  } catch (error) {
    this.log.error(`API request failed: ${error.message}`);
    throw error;
  }
}
```

## Webhook Handling

### Express Server Setup
- Use Express.js for webhook endpoints
- Implement proper request parsing (JSON, form-data)
- Add error handling middleware
- Validate webhook authenticity when possible
- Handle concurrent webhook requests

### Plex Webhook Processing
```javascript
setupWebhookServer() {
  this.server = express();
  this.server.use(bodyParser.json());
  this.server.use(bodyParser.urlencoded({ extended: true }));
  
  this.server.post('/webhook', (req, res) => {
    try {
      this.processPlexWebhook(req.body);
      res.status(200).send('OK');
    } catch (error) {
      this.log.error(`Webhook processing failed: ${error.message}`);
      res.status(500).send('Error');
    }
  });
  
  this.server.listen(this.config.webhookPort, () => {
    this.log.info(`Webhook server listening on port ${this.config.webhookPort}`);
  });
}
```

## Performance

### Memory Management
- Clean up event listeners in unload()
- Clear intervals and timeouts
- Close database connections
- Remove temporary files

### Optimization Tips
- Use object caching for frequently accessed data
- Implement debouncing for rapid state changes
- Batch API requests when possible
- Use efficient data structures for large datasets

### Plex-Specific Performance
- Cache media library information to reduce API calls
- Implement intelligent polling intervals based on activity
- Use webhook events instead of polling when available
- Optimize state updates to prevent unnecessary writes

## Security

### General Security
- Validate all user inputs
- Sanitize data before logging
- Use secure communication (HTTPS) when possible
- Store sensitive data (tokens, passwords) in native config
- Never log sensitive information

### Plex Security Considerations
- Protect Plex authentication tokens
- Validate webhook sources when possible  
- Implement rate limiting for API endpoints
- Use secure connection to Plex server when available
- Handle user authentication for admin interface

## Documentation

### Code Documentation
- Add JSDoc comments for all public methods
- Document complex algorithms and business logic
- Include examples in function documentation
- Keep documentation up to date with code changes

### User Documentation
- Provide clear setup instructions
- Document all configuration options
- Include troubleshooting guides
- Maintain changelog for version updates

## Common Patterns

### Startup Sequence
```javascript
async onReady() {
  try {
    // 1. Validate configuration
    if (!this.validateConfig()) {
      this.log.error('Invalid configuration');
      return;
    }
    
    // 2. Initialize connections
    await this.initializeConnections();
    
    // 3. Create object structure
    await this.createObjectStructure();
    
    // 4. Start data collection
    await this.startDataCollection();
    
    // 5. Set adapter as connected
    this.setState('info.connection', true, true);
    
  } catch (error) {
    this.log.error(`Startup failed: ${error.message}`);
    this.setState('info.connection', false, true);
  }
}
```

### Clean Shutdown
```javascript
onUnload(callback) {
  try {
    // Stop all intervals
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Close server connections
    if (this.server) {
      this.server.close();
    }
    
    // Disconnect from external services
    if (this.plexApi) {
      this.plexApi.disconnect();
    }
    
    // Set offline status
    this.setState('info.connection', false, true);
    
    callback();
  } catch (error) {
    this.log.error(`Shutdown error: ${error.message}`);
    callback();
  }
}
```

## Development Best Practices

### Code Quality
- Use ESLint with ioBroker configuration
- Format code consistently with Prettier
- Write meaningful commit messages
- Use TypeScript for better type safety (when applicable)
- Implement comprehensive error handling

### Code Style and Standards
- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

### Version Control
- Follow semantic versioning (semver)
- Tag releases properly
- Maintain detailed changelog
- Use feature branches for development
- Write clear commit messages

### Testing Strategy
- Write tests before implementing features (TDD)
- Maintain high test coverage
- Test all error conditions
- Use continuous integration
- Perform integration testing with real Plex servers when possible

### Release Process
- Update version in package.json and io-package.json
- Update changelog with new features and fixes
- Test thoroughly before release
- Create GitHub releases with release notes
- Submit to ioBroker repository following guidelines

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run demo API tests
      run: npm run test:integration-demo
```

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from the Discovergy adapter:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedPassword = await encryptPassword(harness, "demo_password");
                
                await harness.changeAdapterConfig("your-adapter", {
                    native: {
                        username: "demo@provider.com",
                        password: encryptedPassword,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

This copilot instruction file provides comprehensive guidance for developing and maintaining the ioBroker.plex adapter with focus on Plex Media Server integration, webhook handling, and ioBroker best practices.
