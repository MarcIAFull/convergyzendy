// Smart Search Engine for Menu Products
// Provides intelligent fuzzy matching with synonyms, ingredients, and keywords

interface Product {
  id: string;
  name: string;
  description?: string | null;
  category?: string;
  price: number;
  is_available: boolean;
  search_keywords?: string[];
  ingredients?: string[];
  addons?: any[];
}

interface Synonym {
  original_term: string;
  synonym: string;
}

interface SearchResult {
  product: Product;
  similarity: number;
  matchType: 'exact' | 'name' | 'keyword' | 'ingredient' | 'description' | 'fuzzy';
}

interface SearchOptions {
  maxResults?: number;
  includeUnavailable?: boolean;
  minSimilarity?: number;
}

// Common category synonyms (Portuguese)
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  'bebidas': ['drinks', 'bebida', 'refrigerante', 'refri', 'suco', 'água'],
  'pizzas': ['pizza', 'pizzas'],
  'hambúrgueres': ['hamburger', 'burger', 'hamburguer', 'lanche', 'lanches', 'sanduíche'],
  'sobremesas': ['doces', 'sobremesa', 'dessert', 'desserts', 'açaí', 'sorvete'],
  'massas': ['pasta', 'macarrão', 'espaguete', 'lasanha'],
  'saladas': ['salada', 'salad'],
  'entradas': ['entrada', 'petisco', 'aperitivo', 'starter'],
  'pratos principais': ['prato principal', 'main course', 'refeição'],
  'salgados': ['salgado', 'coxinha', 'pastel', 'empada'],
};

// Common product name abbreviations/synonyms
const COMMON_SYNONYMS: Record<string, string[]> = {
  'coca-cola': ['coca', 'coke', 'coca cola'],
  'guaraná': ['guarana', 'guaraná antarctica'],
  'margherita': ['margarita', 'marguerita', 'marg'],
  'calabresa': ['calabreza', 'cala'],
  'frango': ['galinha', 'chicken'],
  'queijo': ['cheese', 'mussarela', 'mozzarella', 'muçarela'],
  'batata': ['batata frita', 'fries', 'french fries'],
  'portuguesa': ['portuga'],
  'quatro queijos': ['4 queijos', '4queijos', 'four cheese'],
  'pepperoni': ['peperoni', 'pepperonis'],
  // PHASE 3: Hamburger/lanche synonyms
  'x-tudo': ['x tudo', 'xtudo', 'completo', 'tudo'],
  'x-bacon': ['x bacon', 'xbacon', 'bacon'],
  'hambúrguer': ['hamburger', 'hamburguer', 'burger', 'lanche', 'sanduiche', 'sanduíche'],
  'cachorro': ['hot dog', 'hotdog', 'dog', 'cachorro quente'],
  'açaí': ['acai', 'açai'],
  'batata frita': ['batatas', 'fritas', 'fries'],
  'tradicional': ['simples', 'normal', 'classico', 'clássico'],
  'supremo': ['especial', 'premium', 'top'],
  'kids': ['infantil', 'criança', 'crianca'],
};

// ============================================================
// FASE 1: Pizza size mapping (Portuguese colloquial → DB product names)
// ============================================================
const PIZZA_SIZE_SYNONYMS: Record<string, string[]> = {
  // Pequena/Individual → 4 Pedaços
  '4 pedaços': ['pequena', 'individual', 'pequeno', 'mini', 'p', '4 fatias', '4pedacos'],
  '4 pedacos': ['pequena', 'individual', 'pequeno', 'mini', 'p', '4 fatias'],
  
  // Média/Normal → 6 Pedaços  
  '6 pedaços': ['média', 'media', 'normal', 'm', '6 fatias', '6pedacos'],
  '6 pedacos': ['média', 'media', 'normal', 'm', '6 fatias'],
  
  // Grande/Família → 8 Pedaços
  '8 pedaços': ['grande', 'familia', 'família', 'g', '8 fatias', '8pedacos', 'inteira'],
  '8 pedacos': ['grande', 'familia', 'família', 'g', '8 fatias', 'inteira'],
  
  // Gigante → Maracanã/Golias
  'maracanã': ['gigante', 'maracana', '16 pedaços', '16pedacos', 'enorme'],
  'golias': ['mega', 'super grande', '38 pedaços', '38pedacos'],
};

/**
 * Normalizes text for comparison
 * - Lowercase
 * - Remove accents
 * - Trim whitespace
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .trim();
}

/**
 * Tokenizes text into words
 * Note: Allow single-char tokens for known important chars like 'x' (x-tudo, x-bacon)
 */
function tokenize(text: string): string[] {
  const IMPORTANT_SINGLE_CHARS = ['x', 'p', 'm', 'g']; // x-tudo, pizza P/M/G sizes
  return normalizeText(text)
    .split(/[\s\-_,\.]+/)
    .filter(word => word.length > 1 || IMPORTANT_SINGLE_CHARS.includes(word));
}

/**
 * Calculates Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1).fill(null).map(() => 
    Array(a.length + 1).fill(null)
  );
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Calculates similarity between two strings (0-1)
 */
function stringSimilarity(a: string, b: string): number {
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  
  if (normalizedA === normalizedB) return 1.0;
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
    return 0.9;
  }
  
  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLen = Math.max(normalizedA.length, normalizedB.length);
  return maxLen > 0 ? 1 - (distance / maxLen) : 0;
}

/**
 * Calculates token-based fuzzy match score
 * Returns best match score for each query token against product tokens
 */
function fuzzyTokenMatch(queryTokens: string[], productTokens: string[]): number {
  if (queryTokens.length === 0 || productTokens.length === 0) return 0;
  
  let totalScore = 0;
  
  for (const queryToken of queryTokens) {
    let bestMatch = 0;
    
    for (const productToken of productTokens) {
      const similarity = stringSimilarity(queryToken, productToken);
      if (similarity > bestMatch) {
        bestMatch = similarity;
      }
    }
    
    totalScore += bestMatch;
  }
  
  return totalScore / queryTokens.length;
}

/**
 * Expands query using synonyms (database + hardcoded + pizza sizes)
 */
function expandWithSynonyms(query: string, synonyms: Synonym[]): string[] {
  const normalizedQuery = normalizeText(query);
  const expanded = new Set([normalizedQuery]);
  
  // Check database synonyms
  for (const syn of synonyms) {
    const normalizedOriginal = normalizeText(syn.original_term);
    const normalizedSynonym = normalizeText(syn.synonym);
    
    if (normalizedQuery === normalizedOriginal || normalizedQuery === normalizedSynonym) {
      expanded.add(normalizedOriginal);
      expanded.add(normalizedSynonym);
    }
  }
  
  // Check hardcoded synonyms
  for (const [original, syns] of Object.entries(COMMON_SYNONYMS)) {
    const normalizedOriginal = normalizeText(original);
    
    if (normalizedQuery === normalizedOriginal || syns.some(s => normalizeText(s) === normalizedQuery)) {
      expanded.add(normalizedOriginal);
      syns.forEach(s => expanded.add(normalizeText(s)));
    }
  }
  
  // FASE 1: Check pizza size synonyms
  for (const [original, syns] of Object.entries(PIZZA_SIZE_SYNONYMS)) {
    const normalizedOriginal = normalizeText(original);
    
    // If query matches a size synonym, expand to include the DB product name
    if (syns.some(s => normalizeText(s) === normalizedQuery || normalizedQuery.includes(normalizeText(s)))) {
      expanded.add(normalizedOriginal);
      console.log(`[SmartSearch] Pizza size mapping: "${normalizedQuery}" → "${normalizedOriginal}"`);
    }
    
    // If query matches the DB name, add the colloquial synonyms too
    if (normalizedQuery === normalizedOriginal || normalizedQuery.includes(normalizedOriginal)) {
      syns.forEach(s => expanded.add(normalizeText(s)));
    }
  }
  
  return Array.from(expanded);
}

/**
 * Expands category name using synonyms
 */
export function expandCategorySynonyms(category: string): string[] {
  const normalized = normalizeText(category);
  const expanded = new Set([normalized]);
  
  for (const [cat, syns] of Object.entries(CATEGORY_SYNONYMS)) {
    const normalizedCat = normalizeText(cat);
    
    if (normalized === normalizedCat || syns.some(s => normalizeText(s) === normalized)) {
      expanded.add(normalizedCat);
      syns.forEach(s => expanded.add(normalizeText(s)));
    }
  }
  
  return Array.from(expanded);
}

/**
 * Checks if any array elements match query tokens
 */
function matchInArray(arr: string[] | undefined, queryTokens: string[]): boolean {
  if (!arr || arr.length === 0) return false;
  
  for (const item of arr) {
    const normalizedItem = normalizeText(item);
    for (const token of queryTokens) {
      if (normalizedItem.includes(token) || token.includes(normalizedItem)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Main smart search function
 * Searches products with intelligent matching:
 * 1. Exact name match
 * 2. Name substring match
 * 3. Keywords match
 * 4. Ingredients match  
 * 5. Description match
 * 6. Fuzzy token match
 */
export function smartSearchProducts(
  products: Product[],
  query: string | undefined,
  category: string | undefined,
  synonyms: Synonym[] = [],
  options: SearchOptions = {}
): SearchResult[] {
  const { 
    maxResults = 5, 
    includeUnavailable = false,
    minSimilarity = 0.3
  } = options;
  
  // Filter by availability
  let filtered = includeUnavailable 
    ? products 
    : products.filter(p => p.is_available);
  
  // Filter by category if specified
  if (category) {
    const expandedCategories = expandCategorySynonyms(category);
    
    filtered = filtered.filter(p => {
      const productCategory = normalizeText(p.category || '');
      return expandedCategories.some(cat => 
        productCategory.includes(cat) || cat.includes(productCategory)
      );
    });
    
    // If no query, return all products in category
    if (!query) {
      return filtered.slice(0, maxResults).map(product => ({
        product,
        similarity: 0.8,
        matchType: 'name' as const
      }));
    }
  }
  
  // If no query and no category, return first products
  if (!query) {
    return filtered.slice(0, maxResults).map(product => ({
      product,
      similarity: 0.5,
      matchType: 'name' as const
    }));
  }
  
  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenize(query);
  const expandedQueries = expandWithSynonyms(query, synonyms);
  
  console.log(`[SmartSearch] Query: "${query}" → Normalized: "${normalizedQuery}"`);
  console.log(`[SmartSearch] Tokens: [${queryTokens.join(', ')}]`);
  console.log(`[SmartSearch] Expanded: [${expandedQueries.join(', ')}]`);
  console.log(`[SmartSearch] Products to search: ${filtered.length} (available: ${products.filter(p => p.is_available).length}, total input: ${products.length})`);
  
  // DEBUG: Log first few product names to verify data
  if (filtered.length > 0) {
    console.log(`[SmartSearch] Sample products: ${filtered.slice(0, 5).map(p => p.name).join(', ')}`);
  }
  
  const scored: SearchResult[] = [];
  
  for (const product of filtered) {
    const normalizedName = normalizeText(product.name);
    const nameTokens = tokenize(product.name);
    const normalizedDesc = normalizeText(product.description || '');
    
    let score = 0;
    let matchType: SearchResult['matchType'] = 'fuzzy';
    
    // Check against all expanded query variants
    for (const expandedQuery of expandedQueries) {
      // 1. Exact name match (score: 1.0)
      if (normalizedName === expandedQuery) {
        score = Math.max(score, 1.0);
        matchType = 'exact';
        break; // Best possible match
      }
      
      // 2. Name contains query (score: 0.90)
      if (normalizedName.includes(expandedQuery)) {
        if (score < 0.90) {
          score = 0.90;
          matchType = 'name';
        }
      }
      
      // 2b. PHASE 3 FIX: Name contains query WITH hyphen/space normalization
      // "x-tudo" should match "x tudo" and vice versa
      const normalizedNameNoHyphen = normalizedName.replace(/-/g, ' ').replace(/\s+/g, ' ');
      const expandedQueryNoHyphen = expandedQuery.replace(/-/g, ' ').replace(/\s+/g, ' ');
      
      if (normalizedNameNoHyphen.includes(expandedQueryNoHyphen) || 
          expandedQueryNoHyphen.includes(normalizedNameNoHyphen)) {
        if (score < 0.88) {
          score = 0.88;
          matchType = 'name';
        }
      }
      
      // 3. Query contains product name (useful for long queries)
      if (expandedQuery.includes(normalizedName) && normalizedName.length >= 3) {
        if (score < 0.85) {
          score = 0.85;
          matchType = 'name';
        }
      }
      
      // 3b. PHASE 3: Check if any query token matches any name token exactly
      const queryTokensForMatch = tokenize(expandedQuery);
      const nameTokensForMatch = tokenize(normalizedName);
      
      const tokenExactMatch = queryTokensForMatch.some(qt => 
        nameTokensForMatch.some(nt => qt === nt && qt.length >= 3)
      );
      
      if (tokenExactMatch && score < 0.82) {
        score = 0.82;
        matchType = 'name';
      }
    }
    
    // 4. Keywords match (score: 0.80)
    if (score < 0.80 && matchInArray(product.search_keywords, queryTokens)) {
      score = 0.80;
      matchType = 'keyword';
    }
    
    // 5. Ingredients match (score: 0.75)
    if (score < 0.75 && matchInArray(product.ingredients, queryTokens)) {
      score = 0.75;
      matchType = 'ingredient';
    }
    
    // 6. Description match (score: 0.65)
    if (score < 0.65) {
      for (const expandedQuery of expandedQueries) {
        if (normalizedDesc.includes(expandedQuery)) {
          score = 0.65;
          matchType = 'description';
          break;
        }
      }
    }
    
    // 7. Token-based fuzzy match
    if (score < 0.5) {
      const fuzzyScore = fuzzyTokenMatch(queryTokens, nameTokens);
      if (fuzzyScore > score) {
        score = fuzzyScore;
        matchType = 'fuzzy';
      }
    }
    
    // 8. Final check: any word overlap
    if (score < minSimilarity) {
      const hasOverlap = queryTokens.some(qt => 
        nameTokens.some(nt => nt.includes(qt) || qt.includes(nt))
      );
      if (hasOverlap) {
        score = Math.max(score, 0.35);
      }
    }
    
    if (score >= minSimilarity) {
      scored.push({ product, similarity: score, matchType });
    }
  }
  
  // Sort by similarity descending
  scored.sort((a, b) => b.similarity - a.similarity);
  
  const results = scored.slice(0, maxResults);
  
  console.log(`[SmartSearch] Found ${scored.length} matches, returning top ${results.length}`);
  results.forEach((r, i) => {
    console.log(`[SmartSearch]   ${i + 1}. ${r.product.name} (${r.matchType}: ${(r.similarity * 100).toFixed(0)}%)`);
  });
  
  return results;
}
