/**
 * English (US) localization strings
 */
export const en = {
  // App shell
  'app.title': 'Circuit Séance',
  'app.subtitle': '电路招魂',
  'app.tagline': 'Live SPICE simulation in your browser',

  // Navigation and controls
  'nav.language': 'Language',
  'nav.settings': 'Settings',
  'nav.languageEn': 'English',
  'nav.languageZh': '中文',

  // Example circuits
  'examples.title': 'Example Circuits',
  'examples.rcLowpass': 'RC Low-pass Filter',
  'examples.rl': 'RL Circuit',
  'examples.rlcRinging': 'RLC Ringing',
  'examples.diodeRectifier': 'Diode Rectifier',
  'examples.bjtCommonEmitter': 'BJT Common-Emitter Amp',
  'examples.opampInverting': 'Op-amp Inverting Amp',

  // Capture panel
  'capture.title': 'Capture Schematic',
  'capture.capture': 'Capture',
  'capture.upload': 'Upload',
  'capture.fileTooLarge': 'Image exceeds 5 MB. Auto-compressing...',
  'capture.fileApiUnsupported': 'File API not supported in this browser.',
  'capture.preview': 'Schematic preview',

  // Transcribe panel
  'transcribe.title': 'Transcribe to SPICE',
  'transcribe.transcribe': 'Transcribe',
  'transcribe.transcribing': 'Transcribing...',
  'transcribe.transcriptionFailed': 'Spirit could not read the circuit.',
  'transcribe.enterManually': 'Try entering the netlist manually.',
  'transcribe.confidence': 'Confidence note',
  'transcribe.demo': 'DEMO',
  'transcribe.offline': 'Offline mode',

  // Netlist editor
  'netlist.title': 'SPICE Netlist',
  'netlist.validate': 'Validate',
  'netlist.simulate': 'Simulate',
  'netlist.validationPassed': 'Netlist is valid.',
  'netlist.validationFailed': 'Spirits are restless',
  'netlist.syntaxError': 'Syntax error',
  'netlist.elementError': 'Element or node error',
  'netlist.ngspiceError': 'ngspice error',
  'netlist.errors': 'Errors',
  'netlist.warnings': 'Warnings',

  // Scope display
  'scope.title': 'Oscilloscope',
  'scope.noSignal': 'No signal — summon a circuit',
  'scope.summoning': 'Summoning…',
  'scope.simulationComplete': 'Simulation complete',
  'scope.simulationError': 'Simulation error',
  'scope.spiritsRestless': 'The spirits are restless',
  'scope.voltPerDiv': 'Volts/div',
  'scope.timePerDiv': 'Time/div',
  'scope.channel': 'Channel',
  'scope.enable': 'Enable',
  'scope.variable': 'Variable',

  // Spirit panel
  'spirit.title': 'The Spirit',
  'spirit.askTheSpirit': 'Ask the Spirit',
  'spirit.explaining': 'Consulting the spirit...',
  'spirit.explanationFailed': 'The spirit fell silent.',
  'spirit.retry': 'Retry',
  'spirit.offline': 'Offline mode',
  'spirit.demo': 'DEMO',
  'spirit.tryNext': 'Try next:',

  // Homework check
  'homework.title': 'Homework Check',
  'homework.expected': 'Expected value',
  'homework.actual': 'Actual value',
  'homework.check': 'Check',
  'homework.pass': 'Correct!',
  'homework.fail': 'Not quite.',
  'homework.error': 'Error',
  'homework.withinTolerance': 'within 5% tolerance',

  // Settings
  'settings.title': 'Settings',
  'settings.llmProvider': 'LLM Provider',
  'settings.apiKey': 'API Key',
  'settings.baseUrl': 'Base URL',
  'settings.model': 'Model',
  'settings.rememberSession': 'Remember across sessions',
  'settings.save': 'Save',
  'settings.close': 'Close',
  'settings.selectProvider': 'Select a provider',

  // Status bar
  'status.idle': 'Ready',
  'status.loading': 'Loading WASM engine...',
  'status.running': 'Simulating...',
  'status.complete': 'Simulation complete',
  'status.error': 'Error',

  // Demo mode
  'demo.introTitle': 'Circuit Séance',
  'demo.introSubtitle': '电路招魂',
  'demo.introText': 'Resurrect the spirits of SPICE and the oscilloscope',
  'demo.skip': 'Skip',
  'demo.badge': 'DEMO',

  // Error messages
  'error.noImage': 'No image selected.',
  'error.noApiKey': 'API key not configured.',
  'error.networkError': 'Network error.',
  'error.parseError': 'Could not parse response.',
  'error.unknown': 'Unknown error',
} as const;
