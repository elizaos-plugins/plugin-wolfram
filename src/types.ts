// ActionResult interface for action chaining support
// This should be imported from @elizaos/core when available
export interface ActionResult {
  /** Whether the action succeeded - defaults to true */
  success: boolean;

  /** Optional text description of the result */
  text?: string;

  /** Values to merge into the state */
  values?: Record<string, any>;

  /** Data payload containing action-specific results */
  data?: Record<string, any>;

  /** Error information if the action failed */
  error?: string | Error;
}

// Context provided to actions during execution
export interface ActionContext {
  /** Results from previously executed actions in this run */
  previousResults: ActionResult[];

  /** Get a specific previous result by action name */
  getPreviousResult?: (actionName: string) => ActionResult | undefined;
}

// Original types below...
export interface WolframAlphaQueryResult {
  success: boolean;
  error?: string;
  numpods?: number;
  pods?: WolframPod[];
  assumptions?: WolframAssumption[];
  warnings?: WolframWarning[];
  sources?: WolframSource[];
  didyoumeans?: WolframDidYouMean[];
  languagemsg?: string;
  futuretopic?: string;
  relatedexamples?: string[];
  examplepage?: string;
  generalization?: WolframGeneralization;
  inputstring?: string;
  parsetimedout?: boolean;
  recalculate?: string;
  id?: string;
  server?: string;
  related?: string;
  version?: string;
}

export interface WolframPod {
  title: string;
  scanner: string;
  id: string;
  position: number;
  error: boolean;
  numsubpods: number;
  subpods: WolframSubpod[];
  primary?: boolean;
  expressiontypes?: string[];
  states?: WolframState[];
  infos?: WolframInfo[];
  definitions?: WolframDefinition[];
}

export interface WolframSubpod {
  title?: string;
  img?: WolframImage;
  plaintext?: string;
  mathml?: string;
  sound?: WolframSound;
  imagemap?: WolframImageMap;
  infos?: WolframInfo[];
}

export interface WolframImage {
  src: string;
  alt: string;
  title: string;
  width: number;
  height: number;
  type?: string;
  themes?: string[];
  colorinvertable?: boolean;
}

export interface WolframSound {
  src: string;
  type: string;
}

export interface WolframImageMap {
  rects: WolframRect[];
}

export interface WolframRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  query: string;
  assumptions?: string;
  title?: string;
}

export interface WolframAssumption {
  type: string;
  word?: string;
  template?: string;
  count?: number;
  values?: WolframAssumptionValue[];
}

export interface WolframAssumptionValue {
  name: string;
  desc: string;
  input: string;
  word?: string;
}

export interface WolframWarning {
  text: string;
  spellcheck?: WolframSpellcheck;
  delimiters?: WolframDelimiters;
  translation?: WolframTranslation;
  reinterpret?: WolframReinterpret;
}

export interface WolframSpellcheck {
  word: string;
  suggestion: string;
  text: string;
}

export interface WolframDelimiters {
  text: string;
}

export interface WolframTranslation {
  phrase: string;
  trans: string;
  lang: string;
  text: string;
}

export interface WolframReinterpret {
  text: string;
  new?: string;
  alternatives?: WolframAlternative[];
  level?: string;
}

export interface WolframAlternative {
  text: string;
  input: string;
  level?: string;
  score?: number;
}

export interface WolframSource {
  url: string;
  text?: string;
}

export interface WolframDidYouMean {
  score: number;
  level: string;
  text?: string;
  input?: string;
}

export interface WolframGeneralization {
  topic: string;
  desc: string;
  url: string;
}

export interface WolframState {
  name: string;
  input: string;
  states?: WolframState[];
}

export interface WolframInfo {
  text?: string;
  img?: WolframImage;
  links?: WolframLink[];
  units?: WolframUnits[];
}

export interface WolframLink {
  url: string;
  text: string;
  title?: string;
}

export interface WolframUnits {
  short: string;
  long: string;
}

export interface WolframDefinition {
  word: string;
  desc: string;
}

export interface WolframConversationResult {
  conversationID: string;
  host: string;
  s: string;
  result?: string;
  error?: string;
  expired?: boolean;
}

export interface WolframSimpleResult {
  result: string;
  success: boolean;
  error?: string;
}

export interface WolframShortAnswerResult {
  answer: string;
  success: boolean;
  error?: string;
}

export interface WolframSpokenResult {
  spoken: string;
  success: boolean;
  error?: string;
}

export interface WolframQueryOptions {
  input: string;
  format?: string;
  output?: string;
  appid?: string;
  assumption?: string;
  podstate?: string;
  includepodid?: string;
  excludepodid?: string;
  podtitle?: string;
  podindex?: string;
  scanner?: string;
  async?: boolean;
  ip?: string;
  location?: string;
  gps?: string;
  ignorecase?: boolean;
  translation?: boolean;
  reinterpret?: boolean;
  width?: number;
  maxwidth?: number;
  plotwidth?: number;
  mag?: number;
  scantimeout?: number;
  podtimeout?: number;
  formattimeout?: number;
  parsetimeout?: number;
  totaltimeout?: number;
  units?: "metric" | "imperial";
}

export interface WolframLLMOptions {
  input: string;
  appid: string;
  conversationID?: string;
  maxchars?: number;
}

export enum WolframAPIEndpoint {
  QUERY = "/query",
  SIMPLE = "/simple",
  SHORT = "/short",
  SPOKEN = "/spoken",
  RESULT = "/result",
  // Note: LLM and CONVERSATION are absolute endpoints on a different host
  LLM = "https://www.wolframalpha.com/api/v1/llm-api",
  CONVERSATION = "https://www.wolframalpha.com/api/v1/conversation.jsp",
}

export interface WolframCacheEntry {
  query: string;
  result: any;
  timestamp: number;
  ttl: number;
}

export interface WolframAnalysisResult {
  input: string;
  results: Record<string, string[] | string>;
  error?: string;
}

export interface WolframServiceStats {
  cacheSize: number;
  activeConversations: number;
  config: {
    units?: "metric" | "imperial";
    location?: string;
    maxResults?: number;
  };
}

export interface WolframServiceOptions {
  appId: string;
  cloudApiKey?: string;
  endpoint?: string;
  timeout?: number;
  cache?: boolean;
  cacheTTL?: number;
  units?: "metric" | "imperial";
  location?: string;
  maxResults?: number;
}
