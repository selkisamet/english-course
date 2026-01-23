import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') })

const OXFORD_BASE_URL = process.env.OXFORD_BASE_URL
const OXFORD_APP_ID = process.env.OXFORD_APP_ID
const OXFORD_APP_KEY = process.env.OXFORD_APP_KEY
const DEEPL_API_KEY = process.env.DEEPL_API_KEY

const OUTPUT_FILE = path.join(__dirname, '../data/oxford3000.json')
const ENRICHMENT_CACHE_FILE = path.join(__dirname, '../data/wordEnrichmentCache.json')
const PROGRESS_FILE = path.join(__dirname, '../data/populationProgress.json')
const OXFORD_3000_LIST = path.join(__dirname, '../data/oxford3000-words.txt')

// Oxford 3000 kelime listesi (alfabetik sıralı)
const OXFORD_3000_WORDS = [
  'abandon', 'ability', 'able', 'about', 'above', 'abroad', 'absence', 'absent', 'absolute', 'absolutely',
  'absorb', 'abuse', 'academic', 'accept', 'acceptable', 'access', 'accident', 'accompany', 'according', 'account',
  'accurate', 'accuse', 'achieve', 'achievement', 'acid', 'acknowledge', 'acquire', 'across', 'act', 'action',
  'active', 'activist', 'activity', 'actor', 'actress', 'actual', 'actually', 'ad', 'adapt', 'add',
  'addition', 'additional', 'address', 'adequate', 'adjust', 'adjustment', 'administration', 'admire', 'admission', 'admit',
  'adopt', 'adult', 'advance', 'advanced', 'advantage', 'adventure', 'advertising', 'advice', 'advise', 'affair',
  'affect', 'afford', 'afraid', 'after', 'afternoon', 'afterwards', 'again', 'against', 'age', 'agency',
  'agenda', 'agent', 'aggressive', 'ago', 'agree', 'agreement', 'agriculture', 'ahead', 'aid', 'aim',
  'air', 'aircraft', 'airline', 'airport', 'alarm', 'album', 'alcohol', 'alive', 'all', 'alliance',
  'allow', 'ally', 'almost', 'alone', 'along', 'alongside', 'already', 'also', 'alter', 'alternative',
  'although', 'always', 'amazing', 'among', 'amount', 'analyse', 'analysis', 'ancient', 'and', 'anger',
  'angle', 'angry', 'animal', 'announce', 'annual', 'another', 'answer', 'anticipate', 'anxiety', 'anxious',
  'any', 'anybody', 'anymore', 'anyone', 'anything', 'anyway', 'anywhere', 'apart', 'apartment', 'apparent',
  'apparently', 'appeal', 'appear', 'appearance', 'apple', 'application', 'apply', 'appoint', 'appointment', 'appreciate',
  'approach', 'appropriate', 'approval', 'approve', 'april', 'area', 'argue', 'argument', 'arise', 'arm',
  'armed', 'army', 'around', 'arrange', 'arrangement', 'arrest', 'arrival', 'arrive', 'art', 'article',
  'artist', 'as', 'ashamed', 'aside', 'ask', 'asleep', 'aspect', 'assess', 'assessment', 'asset',
  'assign', 'assignment', 'assist', 'assistance', 'assistant', 'associate', 'association', 'assume', 'assumption', 'assure',
  'at', 'atmosphere', 'attach', 'attack', 'attempt', 'attend', 'attention', 'attitude', 'attorney', 'attract',
  'attractive', 'audience', 'august', 'aunt', 'author', 'authority', 'automatic', 'autumn', 'available', 'average',
  'avoid', 'award', 'aware', 'awareness', 'away', 'awful', 'baby', 'back', 'background', 'bad',
  'badly', 'bag', 'bake', 'balance', 'ball', 'ban', 'band', 'bank', 'bar', 'barely',
  'barrier', 'base', 'basic', 'basically', 'basis', 'basket', 'bathroom', 'battery', 'battle', 'be',
  'beach', 'bear', 'beat', 'beautiful', 'beauty', 'because', 'become', 'bed', 'bedroom', 'beer',
  'before', 'begin', 'beginning', 'behalf', 'behave', 'behaviour', 'behind', 'being', 'belief', 'believe',
  'bell', 'belong', 'below', 'belt', 'bench', 'bend', 'beneath', 'benefit', 'beside', 'best',
  'bet', 'better', 'between', 'beyond', 'bicycle', 'big', 'bike', 'bill', 'billion', 'bind',
  'biological', 'bird', 'birth', 'birthday', 'bit', 'bite', 'bitter', 'black', 'blade', 'blame',
  'blank', 'blind', 'block', 'blood', 'blow', 'blue', 'board', 'boat', 'body', 'bone',
  'book', 'boot', 'border', 'boring', 'born', 'borrow', 'boss', 'both', 'bother', 'bottle',
  'bottom', 'bowl', 'box', 'boy', 'boyfriend', 'brain', 'branch', 'brand', 'brave', 'bread',
  'break', 'breakfast', 'breath', 'breathe', 'brick', 'bridge', 'brief', 'briefly', 'bright', 'brilliant',
  'bring', 'broad', 'brother', 'brown', 'brush', 'budget', 'build', 'building', 'bullet', 'burn',
  'bury', 'bus', 'business', 'busy', 'but', 'butter', 'button', 'buy', 'buyer', 'by',
  'cabinet', 'cable', 'cake', 'calculate', 'call', 'calm', 'camera', 'camp', 'campaign', 'campus',
  'can', 'cancel', 'cancer', 'candidate', 'cap', 'capability', 'capable', 'capacity', 'capital', 'captain',
  'capture', 'car', 'card', 'care', 'career', 'careful', 'carefully', 'carry', 'case', 'cash',
  'cast', 'cat', 'catch', 'category', 'cause', 'ceiling', 'celebrate', 'celebration', 'cell', 'cent',
  'central', 'centre', 'century', 'ceremony', 'certain', 'certainly', 'chain', 'chair', 'chairman', 'challenge',
  'chamber', 'champion', 'championship', 'chance', 'change', 'channel', 'chapter', 'character', 'characteristic', 'charge',
  'charity', 'chart', 'chase', 'cheap', 'cheat', 'check', 'cheek', 'cheerful', 'cheese', 'chef',
  'chemical', 'chemistry', 'chest', 'chicken', 'chief', 'child', 'childhood', 'chip', 'chocolate', 'choice',
  'choose', 'Christmas', 'church', 'cigarette', 'cinema', 'circle', 'circumstance', 'cite', 'citizen', 'city',
  'civil', 'claim', 'class', 'classic', 'classroom', 'clean', 'clear', 'clearly', 'client', 'climate',
  'climb', 'clock', 'close', 'closed', 'closely', 'clothes', 'clothing', 'cloud', 'club', 'clue',
  'coach', 'coal', 'coast', 'coat', 'code', 'coffee', 'cold', 'collapse', 'colleague', 'collect',
  'collection', 'college', 'colour', 'column', 'combination', 'combine', 'come', 'comedy', 'comfort', 'comfortable',
  'command', 'comment', 'commercial', 'commission', 'commit', 'commitment', 'committee', 'common', 'communicate', 'communication',
  'community', 'company', 'compare', 'comparison', 'compete', 'competition', 'competitive', 'competitor', 'complain', 'complaint',
  'complete', 'completely', 'complex', 'complicated', 'component', 'computer', 'concentrate', 'concentration', 'concept', 'concern',
  'concerned', 'concert', 'conclude', 'conclusion', 'concrete', 'condition', 'conduct', 'conference', 'confidence', 'confident',
  'confirm', 'conflict', 'confront', 'confuse', 'confused', 'confusion', 'connect', 'connection', 'conscious', 'consensus',
  'consequence', 'conservative', 'consider', 'considerable', 'consideration', 'consist', 'consistent', 'constant', 'constantly', 'constitute',
  'construct', 'construction', 'consult', 'consumer', 'contact', 'contain', 'contemporary', 'content', 'contest', 'context',
  'continue', 'contract', 'contrast', 'contribute', 'contribution', 'control', 'controversial', 'convention', 'conventional', 'conversation',
  'convert', 'convince', 'cook', 'cookie', 'cooking', 'cool', 'cooperation', 'cope', 'copy', 'core',
  'corner', 'corporate', 'correct', 'correctly', 'cost', 'cottage', 'cotton', 'could', 'council', 'count',
  'counter', 'country', 'countryside', 'county', 'couple', 'courage', 'course', 'court', 'cousin', 'cover',
  'coverage', 'cow', 'crack', 'crash', 'crazy', 'cream', 'create', 'creation', 'creative', 'creature',
  'credit', 'crew', 'crime', 'criminal', 'crisis', 'criteria', 'critic', 'critical', 'criticism', 'criticize',
  'crop', 'cross', 'crowd', 'crowded', 'crucial', 'crude', 'cry', 'cultural', 'culture', 'cup',
  'cup board', 'curious', 'currency', 'current', 'currently', 'curtain', 'curve', 'custom', 'customer', 'cut',
  'cute', 'cycle', 'dad', 'daily', 'damage', 'dance', 'dancer', 'danger', 'dangerous', 'dare',
  'dark', 'data', 'date', 'daughter', 'day', 'dead', 'deal', 'dealer', 'dear', 'death',
  'debate', 'debt', 'decade', 'december', 'decent', 'decide', 'decision', 'declare', 'decline', 'decorate',
  'decoration', 'decrease', 'deep', 'deeply', 'defeat', 'defence', 'defend', 'define', 'definitely', 'definition',
  'degree', 'delay', 'deliver', 'delivery', 'demand', 'demonstrate', 'dentist', 'deny', 'department', 'depend',
  'deposit', 'depress', 'depressed', 'depression', 'depth', 'derive', 'describe', 'description', 'desert', 'deserve',
  'design', 'designer', 'desire', 'desk', 'desperate', 'despite', 'destroy', 'detail', 'detailed', 'detect',
  'determine', 'develop', 'development', 'device', 'devote', 'dialogue', 'diamond', 'diary', 'dictionary', 'die',
  'diet', 'differ', 'difference', 'different', 'differently', 'difficult', 'difficulty', 'dig', 'digital', 'dinner',
  'direct', 'direction', 'directly', 'director', 'dirt', 'dirty', 'disability', 'disabled', 'disagree', 'disappear',
  'disappoint', 'disappointed', 'disappointing', 'disappointment', 'disaster', 'disc', 'discipline', 'discount', 'discover', 'discovery',
  'discrimination', 'discuss', 'discussion', 'disease', 'dish', 'dismiss', 'display', 'distance', 'distribution', 'district',
  'disturb', 'divide', 'division', 'divorced', 'do', 'doctor', 'document', 'dog', 'dollar', 'domestic',
  'dominate', 'door', 'double', 'doubt', 'down', 'downstairs', 'downtown', 'dozen', 'draft', 'drag',
  'drama', 'dramatic', 'draw', 'drawer', 'drawing', 'dream', 'dress', 'dressed', 'drink', 'drive',
  'driver', 'drop', 'drug', 'drunk', 'dry', 'due', 'during', 'dust', 'duty', 'each',
  'eager', 'ear', 'early', 'earn', 'earth', 'earthquake', 'ease', 'easily', 'east', 'eastern',
  'easy', 'eat', 'economic', 'economy', 'edge', 'edition', 'editor', 'educate', 'education', 'educational',
  'effect', 'effective', 'efficient', 'effort', 'egg', 'eight', 'eighteen', 'eighty', 'either', 'elderly',
  'elect', 'election', 'electric', 'electricity', 'electronic', 'element', 'elephant', 'eleven', 'else', 'elsewhere',
  'email', 'embarrass', 'embarrassed', 'embarrassing', 'emerge', 'emergency', 'emotion', 'emotional', 'emphasis', 'emphasize',
  'employ', 'employee', 'employer', 'employment', 'empty', 'enable', 'encounter', 'encourage', 'end', 'enemy',
  'energy', 'engage', 'engaged', 'engine', 'engineer', 'engineering', 'enhance', 'enjoy', 'enormous', 'enough',
  'enquiry', 'ensure', 'enter', 'entertain', 'entertainment', 'enthusiasm', 'enthusiastic', 'entire', 'entirely', 'entitle',
  'entry', 'environment', 'environmental', 'equal', 'equally', 'equipment', 'error', 'escape', 'especially', 'essay',
  'essential', 'establish', 'estate', 'estimate', 'even', 'evening', 'event', 'eventually', 'ever', 'every',
  'everybody', 'everyday', 'everyone', 'everything', 'everywhere', 'evidence', 'evil', 'exact', 'exactly', 'exaggerate',
  'exam', 'examination', 'examine', 'example', 'excellent', 'except', 'exception', 'exchange', 'excited', 'excitement',
  'exciting', 'exclude', 'excuse', 'executive', 'exercise', 'exhibition', 'exist', 'existence', 'existing', 'exit',
  'expand', 'expect', 'expectation', 'expense', 'expensive', 'experience', 'experienced', 'experiment', 'expert', 'explain',
  'explanation', 'explode', 'explore', 'explosion', 'export', 'expose', 'express', 'expression', 'extend', 'extent',
  'extra', 'extraordinary', 'extreme', 'extremely', 'eye', 'face', 'facility', 'fact', 'factor', 'factory',
  'fail', 'failure', 'fair', 'fairly', 'faith', 'fall', 'FALSE', 'familiar', 'family', 'famous',
  'fan', 'fancy', 'far', 'farm', 'farmer', 'farming', 'fashion', 'fashionable', 'fast', 'fasten',
  'fat', 'father', 'fault', 'favour', 'favourite', 'fear', 'feather', 'feature', 'february', 'federal',
  'fee', 'feed', 'feel', 'feeling', 'fellow', 'female', 'fence', 'festival', 'fetch', 'fever',
  'few', 'field', 'fifteen', 'fifty', 'fight', 'figure', 'file', 'fill', 'film', 'final',
  'finally', 'finance', 'financial', 'find', 'finding', 'fine', 'finger', 'finish', 'fire', 'firm',
  'first', 'fish', 'fishing', 'fit', 'five', 'fix', 'fixed', 'flag', 'flame', 'flat',
  'flavour', 'flesh', 'flexible', 'flight', 'float', 'flood', 'floor', 'flour', 'flow', 'flower',
  'fly', 'focus', 'fold', 'follow', 'following', 'food', 'foot', 'football', 'for', 'force',
  'forecast', 'foreign', 'forest', 'forever', 'forget', 'forgive', 'fork', 'form', 'formal', 'former',
  'formula', 'fortune', 'forty', 'forward', 'found', 'foundation', 'four', 'fourteen', 'fourth', 'frame',
  'frankly', 'free', 'freedom', 'freeze', 'French', 'frequency', 'frequent', 'frequently', 'fresh', 'Friday',
  'fridge', 'friend', 'friendly', 'friendship', 'frighten', 'frightened', 'frightening', 'from', 'front', 'fruit',
  'frustrate', 'frustrated', 'frustrating', 'fry', 'fuel', 'full', 'fully', 'fun', 'function', 'fund',
  'fundamental', 'funding', 'funeral', 'funny', 'furniture', 'further', 'furthermore', 'future', 'gain', 'game',
  'gang', 'gap', 'garage', 'garbage', 'garden', 'gas', 'gate', 'gather', 'gear', 'general',
  'generally', 'generate', 'generation', 'generous', 'gentle', 'gentleman', 'gently', 'genuine', 'get', 'giant',
  'gift', 'girl', 'girlfriend', 'give', 'given', 'glad', 'glass', 'global', 'glove', 'go',
  'goal', 'god', 'gold', 'golden', 'golf', 'good', 'goodbye', 'goods', 'govern', 'government',
  'governor', 'grab', 'grade', 'gradually', 'graduate', 'grain', 'grand', 'grandfather', 'grandmother', 'grant',
  'grass', 'grateful', 'grave', 'gray', 'great', 'green', 'greet', 'grey', 'ground', 'group',
  'grow', 'growth', 'guarantee', 'guard', 'guess', 'guest', 'guide', 'guilty', 'gun', 'guy',
  'habit', 'hair', 'half', 'hall', 'hand', 'handle', 'hang', 'happen', 'happy', 'hard',
  'hardly', 'harm', 'hate', 'have', 'he', 'head', 'headline', 'headquarters', 'health', 'healthy',
  'hear', 'hearing', 'heart', 'heat', 'heating', 'heaven', 'heavily', 'heavy', 'heel', 'height',
  'helicopter', 'hell', 'hello', 'help', 'helpful', 'her', 'here', 'hero', 'herself', 'hide',
  'high', 'highlight', 'highly', 'highway', 'hill', 'him', 'himself', 'hip', 'hire', 'his',
  'historian', 'historic', 'historical', 'history', 'hit', 'hold', 'hole', 'holiday', 'holy', 'home',
  'homework', 'honest', 'honestly', 'honour', 'hook', 'hope', 'hopeful', 'hopefully', 'horizon', 'horror',
  'horse', 'hospital', 'host', 'hot', 'hotel', 'hour', 'house', 'household', 'housing', 'how',
  'however', 'huge', 'human', 'humour', 'hundred', 'hungry', 'hunt', 'hurry', 'hurt', 'husband',
  'I', 'ice', 'idea', 'ideal', 'identify', 'identity', 'ignore', 'ill', 'illegal', 'illness',
  'illustrate', 'image', 'imagination', 'imagine', 'immediate', 'immediately', 'impact', 'implement', 'implication', 'imply',
  'import', 'importance', 'important', 'impose', 'impossible', 'impress', 'impressed', 'impression', 'impressive', 'improve',
  'improvement', 'in', 'incident', 'include', 'income', 'increase', 'increasingly', 'incredible', 'indeed', 'independent',
  'index', 'indicate', 'indication', 'individual', 'industrial', 'industry', 'inevitable', 'infection', 'inflation', 'influence',
  'inform', 'information', 'ingredient', 'initial', 'initially', 'initiative', 'injure', 'injured', 'injury', 'inner',
  'innocent', 'innovation', 'input', 'inquiry', 'insect', 'inside', 'insight', 'insist', 'inspect', 'inspection',
  'inspire', 'install', 'instance', 'instant', 'instead', 'institute', 'institution', 'instruction', 'instrument', 'insurance',
  'intelligence', 'intelligent', 'intend', 'intense', 'intention', 'interest', 'interested', 'interesting', 'internal', 'international',
  'internet', 'interpret', 'interpretation', 'interrupt', 'interval', 'intervene', 'intervention', 'interview', 'into', 'introduce',
  'introduction', 'invade', 'invasion', 'invent', 'invest', 'investigate', 'investigation', 'investment', 'investor', 'invitation',
  'invite', 'involve', 'involved', 'iron', 'island', 'issue', 'it', 'item', 'its', 'itself',
  'jacket', 'January', 'jazz', 'jeans', 'job', 'join', 'joint', 'joke', 'journal', 'journalist',
  'journey', 'joy', 'judge', 'judgement', 'juice', 'July', 'jump', 'June', 'junior', 'jury',
  'just', 'justice', 'justify', 'keen', 'keep', 'key', 'keyboard', 'kick', 'kid', 'kill',
  'killing', 'kilometre', 'kind', 'king', 'kiss', 'kitchen', 'knee', 'knife', 'knock', 'know',
  'knowledge', 'lab', 'label', 'laboratory', 'labour', 'lack', 'lady', 'lake', 'lamp', 'land',
  'landscape', 'lane', 'language', 'large', 'largely', 'last', 'late', 'later', 'latest', 'latter',
  'laugh', 'launch', 'law', 'lawyer', 'lay', 'layer', 'lazy', 'lead', 'leader', 'leadership',
  'leading', 'leaf', 'league', 'lean', 'learn', 'learning', 'least', 'leather', 'leave', 'lecture',
  'left', 'leg', 'legacy', 'legal', 'legend', 'leisure', 'lemon', 'lend', 'length', 'less',
  'lesson', 'let', 'letter', 'level', 'liberal', 'library', 'licence', 'lie', 'life', 'lift',
  'light', 'like', 'likely', 'limit', 'limited', 'line', 'link', 'lip', 'liquid', 'list',
  'listen', 'literally', 'literary', 'literature', 'little', 'live', 'living', 'load', 'loan', 'local',
  'locate', 'location', 'lock', 'long', 'look', 'loose', 'lord', 'lorry', 'lose', 'loss',
  'lost', 'lot', 'loud', 'love', 'lovely', 'lover', 'low', 'lower', 'loyal', 'luck',
  'lucky', 'lunch', 'lung', 'machine', 'mad', 'magazine', 'magic', 'mail', 'main', 'mainly',
  'maintain', 'maintenance', 'major', 'majority', 'make', 'male', 'mall', 'man', 'manage', 'management',
  'manager', 'manner', 'manufacturer', 'manufacturing', 'many', 'map', 'March', 'march', 'mark', 'market',
  'marketing', 'marriage', 'married', 'marry', 'marvellous', 'mask', 'mass', 'massive', 'master', 'match',
  'mate', 'material', 'matter', 'maximum', 'May', 'may', 'maybe', 'mayor', 'me', 'meal',
  'mean', 'meaning', 'means', 'meanwhile', 'measure', 'measurement', 'meat', 'mechanism', 'media', 'medical',
  'medicine', 'medium', 'meet', 'meeting', 'member', 'membership', 'memory', 'mental', 'mention', 'menu',
  'mere', 'merely', 'mess', 'message', 'messy', 'metal', 'method', 'metre', 'middle', 'might',
  'mild', 'mile', 'military', 'milk', 'million', 'mind', 'mine', 'mineral', 'minister', 'ministry',
  'minor', 'minority', 'minute', 'mirror', 'miss', 'missile', 'missing', 'mission', 'mistake', 'mix',
  'mixed', 'mixture', 'mobile', 'mode', 'model', 'modern', 'modest', 'modify', 'moment', 'monday',
  'money', 'monitor', 'month', 'mood', 'moon', 'moral', 'more', 'moreover', 'morning', 'mortgage',
  'most', 'mostly', 'mother', 'motion', 'motor', 'motorcycle', 'mount', 'mountain', 'mouse', 'mouth',
  'move', 'movement', 'movie', 'much', 'mud', 'multiple', 'multiply', 'mum', 'murder', 'muscle',
  'museum', 'music', 'musical', 'musician', 'must', 'my', 'myself', 'mysterious', 'mystery', 'nail',
  'naked', 'name', 'namely', 'narrow', 'nation', 'national', 'native', 'natural', 'naturally', 'nature',
  'near', 'nearby', 'nearly', 'neat', 'necessarily', 'necessary', 'neck', 'need', 'negative', 'negotiate',
  'negotiation', 'neighbour', 'neighbourhood', 'neither', 'nerve', 'nervous', 'net', 'network', 'never', 'nevertheless',
  'new', 'news', 'newspaper', 'next', 'nice', 'night', 'nine', 'nineteen', 'ninety', 'no',
  'nobody', 'nod', 'noise', 'noisy', 'none', 'nor', 'normal', 'normally', 'north', 'northern',
  'nose', 'not', 'note', 'nothing', 'notice', 'notion', 'novel', 'November', 'now', 'nowhere',
  'nuclear', 'number', 'numerous', 'nurse', 'nut', 'obey', 'object', 'objective', 'obligation', 'observation',
  'observe', 'obtain', 'obvious', 'obviously', 'occasion', 'occasionally', 'occupation', 'occupy', 'occur', 'ocean',
  'October', 'odd', 'of', 'off', 'offence', 'offend', 'offensive', 'offer', 'office', 'officer',
  'official', 'often', 'oh', 'oil', 'OK', 'old', 'on', 'once', 'one', 'onion',
  'online', 'only', 'onto', 'open', 'opening', 'operate', 'operation', 'operator', 'opinion', 'opponent',
  'opportunity', 'oppose', 'opposed', 'opposite', 'opposition', 'option', 'or', 'orange', 'order', 'ordinary',
  'organ', 'organization', 'organize', 'organized', 'origin', 'original', 'originally', 'other', 'otherwise', 'ought',
  'our', 'ourselves', 'out', 'outcome', 'outdoor', 'outdoors', 'outer', 'outline', 'output', 'outside',
  'outstanding', 'oven', 'over', 'overall', 'overcome', 'own', 'owner', 'pace', 'pack', 'package',
  'packet', 'page', 'pain', 'painful', 'paint', 'painter', 'painting', 'pair', 'palace', 'pale',
  'pan', 'panel', 'pants', 'paper', 'parent', 'park', 'parliament', 'part', 'participate', 'particular',
  'particularly', 'partly', 'partner', 'partnership', 'party', 'pass', 'passage', 'passenger', 'passing', 'passion',
  'passive', 'past', 'path', 'patient', 'pattern', 'pause', 'pay', 'payment', 'peace', 'peaceful',
  'pen', 'pence', 'penny', 'pension', 'people', 'pepper', 'per', 'cent', 'percentage', 'perfect',
  'perfectly', 'perform', 'performance', 'perhaps', 'period', 'permanent', 'permission', 'permit', 'person', 'personal',
  'personality', 'personally', 'persuade', 'petrol', 'phase', 'philosophy', 'phone', 'photo', 'photograph', 'photographer',
  'photography', 'phrase', 'physical', 'physically', 'physics', 'piano', 'pick', 'picture', 'piece', 'pig',
  'pile', 'pill', 'pilot', 'pin', 'pink', 'pint', 'pioneer', 'pipe', 'pitch', 'pity',
  'place', 'plain', 'plan', 'plane', 'planet', 'planning', 'plant', 'plastic', 'plate', 'platform',
  'play', 'player', 'please', 'pleased', 'pleasure', 'plenty', 'plot', 'plus', 'pocket', 'poem',
  'poet', 'poetry', 'point', 'poison', 'poisonous', 'police', 'policeman', 'policy', 'polish', 'polite',
  'political', 'politician', 'politics', 'poll', 'pollution', 'pool', 'poor', 'pop', 'popular', 'population',
  'port', 'position', 'positive', 'possess', 'possession', 'possibility', 'possible', 'possibly', 'post', 'pot',
  'potato', 'potential', 'pound', 'pour', 'poverty', 'powder', 'power', 'powerful', 'practical', 'practice',
  'practise', 'praise', 'pray', 'prayer', 'precise', 'predict', 'prefer', 'preference', 'pregnant', 'premises',
  'preparation', 'prepare', 'prepared', 'prescription', 'presence', 'present', 'presentation', 'preserve', 'president', 'press',
  'pressure', 'presumably', 'pretend', 'pretty', 'prevent', 'previous', 'previously', 'price', 'pride', 'priest',
  'primarily', 'primary', 'prime', 'prince', 'princess', 'principal', 'principle', 'print', 'printer', 'printing',
  'prior', 'priority', 'prison', 'prisoner', 'privacy', 'private', 'prize', 'probably', 'problem', 'procedure',
  'proceed', 'process', 'produce', 'producer', 'product', 'production', 'profession', 'professional', 'professor', 'profile',
  'profit', 'program', 'programme', 'progress', 'project', 'prominent', 'promise', 'promote', 'promotion', 'prompt',
  'pronounce', 'proof', 'proper', 'properly', 'property', 'proportion', 'proposal', 'propose', 'prospect', 'protect',
  'protection', 'protest', 'proud', 'prove', 'provide', 'provided', 'province', 'provision', 'psychological', 'public',
  'publication', 'publicity', 'publish', 'publisher', 'pull', 'punish', 'punishment', 'pupil', 'purchase', 'pure',
  'purple', 'purpose', 'pursue', 'push', 'put', 'qualify', 'quality', 'quantity', 'quarter', 'queen',
  'question', 'queue', 'quick', 'quickly', 'quiet', 'quietly', 'quit', 'quite', 'quote', 'race',
  'racing', 'radio', 'rail', 'railway', 'rain', 'raise', 'range', 'rank', 'rapid', 'rapidly',
  'rare', 'rarely', 'rate', 'rather', 'raw', 'reach', 'react', 'reaction', 'read', 'reader',
  'reading', 'ready', 'real', 'realistic', 'reality', 'realize', 'really', 'reason', 'reasonable', 'reasonably',
  'recall', 'receipt', 'receive', 'recent', 'recently', 'reception', 'recipe', 'reckon', 'recognize', 'recommend',
  'record', 'recording', 'recover', 'recovery', 'recycle', 'red', 'reduce', 'reduction', 'refer', 'reference',
  'reflect', 'reflection', 'reform', 'refrigerator', 'refusal', 'refuse', 'regard', 'regime', 'region', 'regional',
  'register', 'regret', 'regular', 'regularly', 'regulation', 'reject', 'relate', 'related', 'relation', 'relationship',
  'relative', 'relatively', 'relax', 'relaxed', 'relaxing', 'release', 'relevant', 'relief', 'religion', 'religious',
  'reluctant', 'rely', 'remain', 'remaining', 'remains', 'remark', 'remarkable', 'remember', 'remind', 'remote',
  'removal', 'remove', 'rent', 'repair', 'repeat', 'repeated', 'replace', 'reply', 'report', 'reporter',
  'represent', 'representation', 'representative', 'republic', 'reputation', 'request', 'require', 'requirement', 'rescue', 'research',
  'researcher', 'reservation', 'reserve', 'resident', 'resist', 'resistance', 'resolution', 'resolve', 'resort', 'resource',
  'respect', 'respond', 'response', 'responsibility', 'responsible', 'rest', 'restaurant', 'restore', 'restriction', 'result',
  'retain', 'retire', 'retired', 'retirement', 'return', 'reveal', 'revenue', 'reverse', 'review', 'revolution',
  'reward', 'rhythm', 'rice', 'rich', 'rid', 'ride', 'right', 'ring', 'rise', 'risk',
  'river', 'road', 'rock', 'role', 'roll', 'romantic', 'roof', 'room', 'root', 'rope',
  'rough', 'roughly', 'round', 'route', 'routine', 'row', 'royal', 'rub', 'rubbish', 'rude',
  'rugby', 'ruin', 'rule', 'ruler', 'run', 'runner', 'running', 'rural', 'rush', 'sack',
  'sad', 'safe', 'safely', 'safety', 'sail', 'sailing', 'sailor', 'salad', 'salary', 'sale',
  'salt', 'same', 'sample', 'sand', 'sandwich', 'satellite', 'satisfaction', 'satisfied', 'satisfy', 'saturday',
  'sauce', 'save', 'saving', 'say', 'scale', 'scared', 'scene', 'schedule', 'scheme', 'scholar',
  'scholarship', 'school', 'science', 'scientific', 'scientist', 'scope', 'score', 'scratch', 'screen', 'screw',
  'script', 'sea', 'search', 'season', 'seat', 'second', 'secondary', 'secret', 'secretary', 'section',
  'sector', 'secure', 'security', 'see', 'seed', 'seek', 'seem', 'select', 'selection', 'self',
  'sell', 'Senate', 'senator', 'send', 'senior', 'sense', 'sensitive', 'sentence', 'separate', 'September',
  'sequence', 'series', 'serious', 'seriously', 'servant', 'serve', 'service', 'session', 'set', 'setting',
  'settle', 'settlement', 'seven', 'seventeen', 'seventh', 'seventy', 'several', 'severe', 'sex', 'sexual',
  'shade', 'shadow', 'shake', 'shall', 'shallow', 'shame', 'shape', 'share', 'sharp', 'she',
  'sheep', 'sheet', 'shelf', 'shell', 'shelter', 'shift', 'shine', 'ship', 'shirt', 'shock',
  'shocked', 'shoe', 'shoot', 'shooting', 'shop', 'shopping', 'shore', 'short', 'shortly', 'shot',
  'should', 'shoulder', 'shout', 'show', 'shower', 'shut', 'sick', 'side', 'sight', 'sign',
  'signal', 'signature', 'significance', 'significant', 'silence', 'silent', 'silk', 'silly', 'silver', 'similar',
  'similarly', 'simple', 'simply', 'since', 'sincere', 'sing', 'singer', 'single', 'sink', 'sir',
  'sister', 'sit', 'site', 'situation', 'six', 'sixteen', 'sixty', 'size', 'ski', 'skiing',
  'skill', 'skin', 'skirt', 'sky', 'slave', 'sleep', 'slice', 'slide', 'slight', 'slightly',
  'slip', 'slow', 'slowly', 'small', 'smart', 'smell', 'smile', 'smoke', 'smoking', 'smooth',
  'snake', 'snow', 'so', 'soap', 'social', 'society', 'sock', 'soft', 'software', 'soil',
  'soldier', 'solicitor', 'solid', 'solution', 'solve', 'some', 'somebody', 'somehow', 'someone', 'something',
  'sometimes', 'somewhat', 'somewhere', 'son', 'song', 'soon', 'sophisticated', 'sore', 'sorry', 'sort',
  'soul', 'sound', 'soup', 'source', 'south', 'southern', 'space', 'spare', 'speak', 'speaker',
  'special', 'specialist', 'species', 'specific', 'specifically', 'speech', 'speed', 'spell', 'spelling', 'spend',
  'spending', 'spin', 'spirit', 'spiritual', 'spite', 'split', 'spoil', 'sponsor', 'spoon', 'sport',
  'spot', 'spread', 'spring', 'square', 'stable', 'staff', 'stage', 'stair', 'stamp', 'stand',
  'standard', 'standing', 'star', 'stare', 'start', 'state', 'statement', 'station', 'statue', 'status',
  'stay', 'steady', 'steal', 'steam', 'steel', 'steep', 'steer', 'stem', 'step', 'stick',
  'stiff', 'still', 'stock', 'stomach', 'stone', 'stop', 'store', 'storm', 'story', 'straight',
  'strange', 'stranger', 'strategic', 'strategy', 'stream', 'street', 'strength', 'strengthen', 'stress', 'stretch',
  'strict', 'strike', 'striking', 'string', 'strip', 'stroke', 'strong', 'strongly', 'structure', 'struggle',
  'student', 'studio', 'study', 'stuff', 'stupid', 'style', 'subject', 'submit', 'subsequent', 'substance',
  'substantial', 'succeed', 'success', 'successful', 'successfully', 'such', 'suck', 'sudden', 'suddenly', 'sue',
  'suffer', 'sufficient', 'sugar', 'suggest', 'suggestion', 'suit', 'suitable', 'sum', 'summary', 'summer',
  'sun', 'sunday', 'super', 'supermarket', 'supply', 'support', 'supporter', 'suppose', 'sure', 'surely',
  'surface', 'surgery', 'surprise', 'surprised', 'surprising', 'surprisingly', 'surround', 'surrounding', 'survey', 'survival',
  'survive', 'survivor', 'suspect', 'suspend', 'suspicion', 'suspicious', 'sustain', 'swear', 'sweep', 'sweet',
  'swim', 'swimming', 'swing', 'switch', 'symbol', 'sympathy', 'symptom', 'system', 'table', 'tablet',
  'tackle', 'tail', 'take', 'tale', 'talent', 'talk', 'tall', 'tank', 'tap', 'tape',
  'target', 'task', 'taste', 'tax', 'taxi', 'tea', 'teach', 'teacher', 'teaching', 'team',
  'tear', 'technical', 'technique', 'technology', 'telephone', 'television', 'tell', 'temperature', 'temporary', 'ten',
  'tend', 'tendency', 'tennis', 'tension', 'tent', 'term', 'terrible', 'territory', 'terror', 'terrorism',
  'terrorist', 'test', 'text', 'than', 'thank', 'thanks', 'that', 'the', 'theatre', 'their',
  'them', 'theme', 'themselves', 'then', 'theory', 'therapy', 'there', 'therefore', 'these', 'they',
  'thick', 'thin', 'thing', 'think', 'thinking', 'third', 'thirsty', 'thirteen', 'thirty', 'this',
  'thorough', 'though', 'thought', 'thousand', 'thread', 'threat', 'threaten', 'three', 'throat', 'through',
  'throughout', 'throw', 'Thursday', 'thus', 'ticket', 'tidy', 'tie', 'tiger', 'tight', 'till',
  'time', 'tiny', 'tip', 'tire', 'tired', 'title', 'to', 'today', 'toe', 'together',
  'toilet', 'tomato', 'tomorrow', 'tone', 'tongue', 'tonight', 'too', 'tool', 'tooth', 'top',
  'topic', 'total', 'totally', 'touch', 'tough', 'tour', 'tourist', 'towards', 'towel', 'tower',
  'town', 'toy', 'trace', 'track', 'trade', 'tradition', 'traditional', 'traffic', 'train', 'trainer',
  'training', 'transfer', 'transform', 'transformation', 'transition', 'translate', 'translation', 'transport', 'transportation', 'trap',
  'travel', 'traveller', 'tray', 'treat', 'treatment', 'treaty', 'tree', 'trend', 'trial', 'triangle',
  'trick', 'trip', 'troop', 'tropical', 'trouble', 'trousers', 'truck', 'true', 'truly', 'trust',
  'truth', 'try', 'T-shirt', 'tube', 'Tuesday', 'tune', 'tunnel', 'turn', 'TV', 'twelve',
  'twenty', 'twice', 'twin', 'two', 'type', 'typical', 'tyre', 'ugly', 'ultimate', 'ultimately',
  'unable', 'uncle', 'under', 'undergo', 'underground', 'understand', 'understanding', 'unemployed', 'unemployment', 'unexpected',
  'unfortunately', 'unhappy', 'uniform', 'union', 'unique', 'unit', 'unite', 'united', 'universe', 'university',
  'unknown', 'unless', 'unlike', 'unlikely', 'until', 'unusual', 'up', 'upon', 'upper', 'upset',
  'upstairs', 'urban', 'urge', 'us', 'use', 'used', 'useful', 'user', 'usual', 'usually',
  'vacation', 'valley', 'valuable', 'value', 'van', 'variation', 'variety', 'various', 'vary', 'vast',
  'vegetable', 'vehicle', 'version', 'vertical', 'very', 'via', 'victim', 'victory', 'video', 'view',
  'village', 'violence', 'violent', 'virtually', 'virtue', 'virus', 'visible', 'vision', 'visit', 'visitor',
  'visual', 'vital', 'voice', 'volume', 'voluntary', 'volunteer', 'vote', 'wage', 'wait', 'wake',
  'walk', 'wall', 'wander', 'want', 'war', 'warm', 'warn', 'warning', 'wash', 'washing',
  'waste', 'watch', 'water', 'wave', 'way', 'we', 'weak', 'weakness', 'wealth', 'weapon',
  'wear', 'weather', 'web', 'website', 'wedding', 'Wednesday', 'week', 'weekend', 'weekly', 'weigh',
  'weight', 'welcome', 'well', 'west', 'western', 'wet', 'what', 'whatever', 'wheel', 'when',
  'whenever', 'where', 'whereas', 'whether', 'which', 'while', 'whilst', 'white', 'who', 'whole',
  'whom', 'whose', 'why', 'wide', 'widely', 'widen', 'widespread', 'wife', 'wild', 'will',
  'willing', 'win', 'wind', 'window', 'wine', 'wing', 'winner', 'winter', 'wipe', 'wire',
  'wise', 'wish', 'with', 'withdraw', 'within', 'without', 'witness', 'woman', 'wonder', 'wonderful',
  'wood', 'wooden', 'word', 'work', 'worker', 'working', 'works', 'workshop', 'world', 'worried',
  'worry', 'worse', 'worst', 'worth', 'would', 'wound', 'wrap', 'write', 'writer', 'writing',
  'wrong', 'yard', 'yeah', 'year', 'yellow', 'yes', 'yesterday', 'yet', 'you', 'young',
  'your', 'yours', 'yourself', 'youth', 'zero', 'zone'
]

// Rate limiting (Free Dictionary API: more generous)
const REQUESTS_PER_MINUTE = 120
const DELAY_BETWEEN_BATCHES = 60000 // 1 minute

// Progress tracking
let progress = {
  processedWords: [],
  failedWords: [],
  lastProcessedIndex: -1,
  startTime: null,
  estimatedTimeRemaining: null
}

// Load existing progress if available
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8')
      progress = JSON.parse(data)
      console.log(`📋 Resuming from word ${progress.lastProcessedIndex + 1}`)
    }
  } catch (error) {
    console.log('📋 Starting fresh (no previous progress found)')
  }
}

// Save progress
function saveProgress() {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
  } catch (error) {
    console.error('❌ Failed to save progress:', error)
  }
}

// Fetch word data from Free Dictionary API
async function fetchWordFromFreeDictionary(word) {
  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`

    const response = await fetch(url)

    if (!response.ok) {
      console.log(`⚠️  Failed to fetch '${word}': ${response.status}`)
      return null
    }

    const data = await response.json()
    return parseFreeDictionaryData(word, data)
  } catch (error) {
    console.error(`❌ Error fetching '${word}':`, error.message)
    return null
  }
}

// Parse Free Dictionary API response
function parseFreeDictionaryData(word, data) {
  try {
    const entry = data[0]
    const meaning = entry.meanings[0]

    // Extract basic info
    const partOfSpeech = meaning.partOfSpeech || 'unknown'

    // Extract definitions
    const definitions = meaning.definitions
      ?.map(def => def.definition)
      .slice(0, 3) || []

    // Extract examples
    const examples = meaning.definitions
      ?.filter(def => def.example)
      .map(def => def.example)
      .slice(0, 5) || []

    // Extract synonyms
    const synonyms = meaning.definitions
      ?.filter(def => def.synonyms && def.synonyms.length > 0)
      .flatMap(def => def.synonyms)
      .slice(0, 5) || []

    // Extract phonetic
    const phonetic = entry.phonetic || entry.phonetics?.[0]?.text || ''

    return {
      word,
      definitions,
      examples,
      synonyms,
      collocations: [],
      phonetic,
      partOfSpeech,
      cefrLevel: 'B1' // Will be assigned later based on frequency
    }
  } catch (error) {
    console.error(`❌ Error parsing data for '${word}':`, error.message)
    return null
  }
}


// Translate text with DeepL
async function translateWithDeepL(text) {
  try {
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: [text],
        target_lang: 'TR',
        source_lang: 'EN'
      })
    })

    if (!response.ok) {
      return ''
    }

    const data = await response.json()
    return data.translations[0].text
  } catch (error) {
    console.error('DeepL error:', error.message)
    return ''
  }
}

// Assign CEFR levels based on frequency (simple heuristic)
function assignCefrLevel(index) {
  if (index < 500) return 'A1'
  if (index < 1000) return 'A2'
  if (index < 1500) return 'B1'
  if (index < 2000) return 'B2'
  if (index < 2500) return 'C1'
  return 'C2'
}

// Determine category based on word patterns (simple heuristic)
function determineCategory(word, partOfSpeech) {
  const categories = []

  // Add POS-based category
  if (partOfSpeech.includes('verb') || partOfSpeech.includes('Verb')) {
    categories.push('action')
  } else if (partOfSpeech.includes('noun') || partOfSpeech.includes('Noun')) {
    categories.push('thing')
  } else if (partOfSpeech.includes('adjective') || partOfSpeech.includes('Adjective')) {
    categories.push('quality')
  }

  // Could add more sophisticated categorization based on word semantics
  // For now, keep it simple

  return categories.length > 0 ? categories : ['general']
}

// Main population function
async function populateOxford3000() {
  console.log('🚀 Starting Oxford 3000 Data Population')
  console.log('📚 Using Free Dictionary API (no authentication required)')
  console.log('=' .repeat(60))

  // Check API credentials for DeepL only
  if (!DEEPL_API_KEY) {
    console.error('❌ DeepL API key not configured in .env.local')
    process.exit(1)
  }

  // Load existing progress
  loadProgress()

  // Load existing data
  let oxfordData = { words: [], metadata: {} }
  let enrichmentCache = {}

  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      const existing = fs.readFileSync(OUTPUT_FILE, 'utf8')
      oxfordData = JSON.parse(existing)
      console.log(`📚 Found ${oxfordData.words.length} existing words`)
    }
  } catch (error) {
    console.log('📚 Starting with empty dataset')
  }

  try {
    if (fs.existsSync(ENRICHMENT_CACHE_FILE)) {
      const existing = fs.readFileSync(ENRICHMENT_CACHE_FILE, 'utf8')
      enrichmentCache = JSON.parse(existing)
      console.log(`💾 Found ${Object.keys(enrichmentCache).length} cached enrichments`)
    }
  } catch (error) {
    console.log('💾 Starting with empty enrichment cache')
  }

  // Determine starting point
  const startIndex = progress.lastProcessedIndex + 1
  const totalWords = OXFORD_3000_WORDS.length
  const remainingWords = totalWords - startIndex

  console.log(`\n📊 Progress: ${startIndex}/${totalWords} words completed`)
  console.log(`⏳ Remaining: ${remainingWords} words`)
  console.log(`\n🔄 Starting processing from word: "${OXFORD_3000_WORDS[startIndex]}"`)
  console.log('=' .repeat(60))

  progress.startTime = progress.startTime || Date.now()

  // Process words in batches
  for (let i = startIndex; i < totalWords; i++) {
    const word = OXFORD_3000_WORDS[i]
    const batchIndex = i % REQUESTS_PER_MINUTE

    console.log(`\n[${i + 1}/${totalWords}] Processing: "${word}"`)

    // Fetch from Free Dictionary API
    const oxfordResult = await fetchWordFromFreeDictionary(word)

    if (oxfordResult) {
      // Translate definition
      const translation = await translateWithDeepL(oxfordResult.definitions[0] || word)

      // Translate examples
      const translatedExamples = []
      for (const example of oxfordResult.examples.slice(0, 3)) {
        const turkishExample = await translateWithDeepL(example)
        translatedExamples.push({
          english: example,
          turkish: turkishExample
        })
      }

      // Create word entry
      const wordEntry = {
        id: `word-${String(i + 1).padStart(4, '0')}`,
        word: word,
        cefrLevel: oxfordResult.cefrLevel || assignCefrLevel(i),
        partOfSpeech: oxfordResult.partOfSpeech,
        frequency: 'high',
        categories: determineCategory(word, oxfordResult.partOfSpeech),
        basicDefinition: oxfordResult.definitions[0] || '',
        basicTranslation: translation
      }

      // Add to oxford3000.json
      const existingIndex = oxfordData.words.findIndex(w => w.word === word)
      if (existingIndex >= 0) {
        oxfordData.words[existingIndex] = wordEntry
      } else {
        oxfordData.words.push(wordEntry)
      }

      // Add to enrichment cache
      enrichmentCache[word.toLowerCase()] = {
        word,
        definitions: oxfordResult.definitions,
        exampleSentences: translatedExamples,
        collocations: oxfordResult.collocations,
        synonyms: oxfordResult.synonyms,
        phonetic: oxfordResult.phonetic,
        partOfSpeech: oxfordResult.partOfSpeech,
        timestamp: new Date().toISOString()
      }

      progress.processedWords.push(word)
      console.log(`✅ Successfully processed "${word}"`)
    } else {
      progress.failedWords.push(word)
      console.log(`❌ Failed to process "${word}"`)
    }

    // Update progress
    progress.lastProcessedIndex = i
    saveProgress()

    // Calculate ETA
    const elapsed = Date.now() - progress.startTime
    const wordsProcessed = i - startIndex + 1
    const avgTimePerWord = elapsed / wordsProcessed
    const remaining = totalWords - i - 1
    const eta = avgTimePerWord * remaining
    const etaMinutes = Math.round(eta / 60000)

    console.log(`⏱️  ETA: ~${etaMinutes} minutes`)

    // Rate limiting: wait after each batch
    if ((i + 1) % REQUESTS_PER_MINUTE === 0 && i < totalWords - 1) {
      console.log(`\n⏸️  Rate limit: Waiting 60 seconds before next batch...`)
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
    } else {
      // Small delay between requests (500ms)
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Save to files periodically (every 50 words)
    if ((i + 1) % 50 === 0) {
      console.log(`\n💾 Saving checkpoint (${i + 1}/${totalWords} words)...`)

      oxfordData.metadata = {
        version: '1.0',
        totalWords: oxfordData.words.length,
        lastUpdated: new Date().toISOString(),
        source: 'Oxford Dictionaries API'
      }

      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(oxfordData, null, 2))
      fs.writeFileSync(ENRICHMENT_CACHE_FILE, JSON.stringify(enrichmentCache, null, 2))

      console.log(`✅ Checkpoint saved`)
    }
  }

  // Final save
  console.log(`\n💾 Saving final data...`)

  oxfordData.metadata = {
    version: '1.0',
    totalWords: oxfordData.words.length,
    lastUpdated: new Date().toISOString(),
    source: 'Oxford Dictionaries API'
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(oxfordData, null, 2))
  fs.writeFileSync(ENRICHMENT_CACHE_FILE, JSON.stringify(enrichmentCache, null, 2))

  // Clean up progress file
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE)
  }

  console.log('\n' + '='.repeat(60))
  console.log('🎉 Population Complete!')
  console.log('='.repeat(60))
  console.log(`✅ Successfully processed: ${progress.processedWords.length} words`)
  console.log(`❌ Failed to process: ${progress.failedWords.length} words`)
  console.log(`📁 Output file: ${OUTPUT_FILE}`)
  console.log(`💾 Enrichment cache: ${ENRICHMENT_CACHE_FILE}`)

  if (progress.failedWords.length > 0) {
    console.log(`\n⚠️  Failed words: ${progress.failedWords.join(', ')}`)
  }
}

// Run the script
populateOxford3000().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
