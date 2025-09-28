# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
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
      adapter = utils.setupAdapter();
    });
    
    afterEach(() => {
      // Clean up after each test
      adapter.terminate && adapter.terminate();
    });
    
    it('should start adapter successfully', (done) => {
      adapter.on('ready', () => {
        expect(adapter.config).toBeDefined();
        done();
      });
    });
  });
  ```

### Integration Testing
- Test real connections to external systems when possible
- Use test data files when external systems are unavailable
- Test all major user scenarios and configurations
- Verify state creation and updates work correctly

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

This copilot instruction file provides comprehensive guidance for developing and maintaining the ioBroker.plex adapter with focus on Plex Media Server integration, webhook handling, and ioBroker best practices.