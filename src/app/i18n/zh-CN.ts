/**
 * Simplified Chinese (中文) localization strings
 */
export const zhCN = {
  // App shell
  'app.title': '电路招魂',
  'app.subtitle': 'Circuit Séance',
  'app.tagline': '浏览器中的实时 SPICE 仿真',

  // Navigation and controls
  'nav.language': '语言',
  'nav.settings': '设置',
  'nav.languageEn': 'English',
  'nav.languageZh': '中文',

  // Example circuits
  'examples.title': '示例电路',
  'examples.rcLowpass': 'RC 低通滤波器',
  'examples.rl': 'RL 电路',
  'examples.rlcRinging': 'RLC 振铃',
  'examples.diodeRectifier': '二极管整流器',
  'examples.bjtCommonEmitter': 'BJT 共射放大器',
  'examples.opampInverting': '运放反相放大器',

  // Capture panel
  'capture.title': '捕获原理图',
  'capture.capture': '拍照',
  'capture.upload': '上传',
  'capture.fileTooLarge': '图像超过 5 MB。正在自动压缩...',
  'capture.fileApiUnsupported': '此浏览器不支持文件 API。',
  'capture.preview': '原理图预览',

  // Transcribe panel
  'transcribe.title': '转录为 SPICE',
  'transcribe.transcribe': '转录',
  'transcribe.transcribing': '正在转录...',
  'transcribe.transcriptionFailed': '灵魂无法识别这个电路。',
  'transcribe.enterManually': '尝试手动输入网表。',
  'transcribe.confidence': '置信度备注',
  'transcribe.demo': '演示',
  'transcribe.offline': '离线模式',

  // Netlist editor
  'netlist.title': 'SPICE 网表',
  'netlist.validate': '验证',
  'netlist.simulate': '仿真',
  'netlist.validationPassed': '网表有效。',
  'netlist.validationFailed': '灵魂们不安',
  'netlist.syntaxError': '语法错误',
  'netlist.elementError': '元件或节点错误',
  'netlist.ngspiceError': 'ngspice 错误',
  'netlist.errors': '错误',
  'netlist.warnings': '警告',

  // Scope display
  'scope.title': '示波器',
  'scope.noSignal': '无信号 — 召唤一个电路',
  'scope.summoning': '正在召唤…',
  'scope.simulationComplete': '仿真完成',
  'scope.simulationError': '仿真错误',
  'scope.spiritsRestless': '灵魂们在躁动',
  'scope.voltPerDiv': '伏/格',
  'scope.timePerDiv': '时间/格',
  'scope.channel': '通道',
  'scope.enable': '启用',
  'scope.variable': '变量',

  // Spirit panel
  'spirit.title': '灵魂',
  'spirit.askTheSpirit': '询问灵魂',
  'spirit.explaining': '正在咨询灵魂...',
  'spirit.explanationFailed': '灵魂沉默了。',
  'spirit.retry': '重试',
  'spirit.offline': '离线模式',
  'spirit.demo': '演示',
  'spirit.tryNext': '下一步尝试：',

  // Homework check
  'homework.title': '作业检查',
  'homework.expected': '预期值',
  'homework.actual': '实际值',
  'homework.check': '检查',
  'homework.pass': '正确！',
  'homework.fail': '还差一点。',
  'homework.error': '错误',
  'homework.withinTolerance': '误差在 5% 以内',

  // Settings
  'settings.title': '设置',
  'settings.llmProvider': '大语言模型提供商',
  'settings.apiKey': 'API 密钥',
  'settings.baseUrl': '基础 URL',
  'settings.model': '模型',
  'settings.rememberSession': '跨会话记住',
  'settings.save': '保存',
  'settings.close': '关闭',
  'settings.selectProvider': '选择提供商',

  // Status bar
  'status.idle': '就绪',
  'status.loading': '正在加载 WASM 引擎...',
  'status.running': '正在仿真...',
  'status.complete': '仿真完成',
  'status.error': '错误',

  // Demo mode
  'demo.introTitle': '电路招魂',
  'demo.introSubtitle': 'Circuit Séance',
  'demo.introText': '唤醒 SPICE 和示波器的灵魂',
  'demo.skip': '跳过',
  'demo.badge': '演示',

  // Error messages
  'error.noImage': '未选择图像。',
  'error.noApiKey': '未配置 API 密钥。',
  'error.networkError': '网络错误。',
  'error.parseError': '无法解析响应。',
  'error.unknown': '未知错误',
} as const;
