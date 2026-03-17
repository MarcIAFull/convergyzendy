/**
 * Smart Search v2 - Paginated search with offset/limit
 * Self-contained (no cross-function imports) to avoid deploy issues.
 * Logic based on whatsapp-ai-agent/smart-search.ts
 */

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  category?: string;
  price: number;
  is_available: boolean;
  search_keywords?: string[];
  ingredients?: string[];
  addons?: unknown[];
  max_addons?: number | null;
  free_addons_count?: number | null;
}

export interface Synonym {
  original_term: string;
  synonym: string;
}

export interface SearchResult {
  product: Product;
  similarity: number;
  matchType: 'exact' | 'name' | 'keyword' | 'ingredient' | 'description' | 'fuzzy';
}

export interface SearchOptionsV2 {
  maxResults?: number;
  offset?: number;
  includeUnavailable?: boolean;
  minSimilarity?: number;
}

export interface PaginatedSearchResult {
  results: SearchResult[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

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

const PIZZA_SIZE_SYNONYMS: Record<string, string[]> = {
  '4 pedaços': ['pequena', 'individual', 'pequeno', 'mini', 'p', '4 fatias', '4pedacos'],
  '4 pedacos': ['pequena', 'individual', 'pequeno', 'mini', 'p', '4 fatias'],
  '6 pedaços': ['média', 'media', 'normal', 'm', '6 fatias', '6pedacos'],
  '6 pedacos': ['média', 'media', 'normal', 'm', '6 fatias'],
  '8 pedaços': ['grande', 'familia', 'família', 'g', '8 fatias', '8pedacos', 'inteira'],
  '8 pedacos': ['grande', 'familia', 'família', 'g', '8 fatias', 'inteira'],
  'maracanã': ['gigante', 'maracana', '16 pedaços', '16pedacos', 'enorme'],
  'golias': ['mega', 'super grande', '38 pedaços', '38pedacos'],
};

export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function tokenize(text: string): string[] {
  const IMPORTANT_SINGLE_CHARS = ['x', 'p', 'm', 'g'];
  return normalizeText(text)
    .split(/[\s\-_,\.]+/)
    .filter(word => word.length > 1 || IMPORTANT_SINGLE_CHARS.includes(word));
}

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
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

function stringSimilarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const d = levenshteinDistance(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen > 0 ? 1 - d / maxLen : 0;
}

function fuzzyTokenMatch(queryTokens: string[], productTokens: string[]): number {
  if (queryTokens.length === 0 || productTokens.length === 0) return 0;
  let total = 0;
  for (const qt of queryTokens) {
    let best = 0;
    for (const pt of productTokens) {
      const s = stringSimilarity(qt, pt);
      if (s > best) best = s;
    }
    total += best;
  }
  return total / queryTokens.length;
}

function expandWithSynonyms(query: string, synonyms: Synonym[]): string[] {
  const nq = normalizeText(query);
  const expanded = new Set([nq]);
  for (const syn of synonyms) {
    const no = normalizeText(syn.original_term);
    const ns = normalizeText(syn.synonym);
    if (nq === no || nq === ns) {
      expanded.add(no);
      expanded.add(ns);
    }
  }
  for (const [orig, syns] of Object.entries(COMMON_SYNONYMS)) {
    const no = normalizeText(orig);
    if (nq === no || syns.some(s => normalizeText(s) === nq)) {
      expanded.add(no);
      syns.forEach(s => expanded.add(normalizeText(s)));
    }
  }
  for (const [orig, syns] of Object.entries(PIZZA_SIZE_SYNONYMS)) {
    const no = normalizeText(orig);
    if (syns.some(s => normalizeText(s) === nq || nq.includes(normalizeText(s)))) expanded.add(no);
    if (nq === no || nq.includes(no)) syns.forEach(s => expanded.add(normalizeText(s)));
  }
  return Array.from(expanded);
}

export function expandCategorySynonyms(category: string): string[] {
  const n = normalizeText(category);
  const expanded = new Set([n]);
  for (const [cat, syns] of Object.entries(CATEGORY_SYNONYMS)) {
    const nc = normalizeText(cat);
    if (n === nc || syns.some(s => normalizeText(s) === n)) {
      expanded.add(nc);
      syns.forEach(s => expanded.add(normalizeText(s)));
    }
  }
  return Array.from(expanded);
}

function matchInArray(arr: string[] | undefined, queryTokens: string[]): boolean {
  if (!arr || arr.length === 0) return false;
  for (const item of arr) {
    const ni = normalizeText(item);
    for (const qt of queryTokens) {
      if (ni.includes(qt) || qt.includes(ni)) return true;
    }
  }
  return false;
}

function smartSearchProductsInternal(
  products: Product[],
  query: string | undefined,
  category: string | undefined,
  synonyms: Synonym[],
  options: { maxResults: number; includeUnavailable: boolean; minSimilarity: number }
): SearchResult[] {
  const { maxResults, includeUnavailable, minSimilarity } = options;
  let filtered = includeUnavailable ? products : products.filter(p => p.is_available);

  if (category) {
    const expanded = expandCategorySynonyms(category);
    filtered = filtered.filter(p => {
      const pc = normalizeText(p.category || '');
      return expanded.some(c => pc.includes(c) || c.includes(pc));
    });
    if (!query) {
      return filtered.map(p => ({ product: p, similarity: 0.8, matchType: 'name' as const }));
    }
  }

  if (!query) {
    return filtered.slice(0, maxResults).map(p => ({ product: p, similarity: 0.5, matchType: 'name' as const }));
  }

  const queryTokens = tokenize(query);
  const expandedQueries = expandWithSynonyms(query, synonyms);
  const scored: SearchResult[] = [];

  for (const product of filtered) {
    const normalizedName = normalizeText(product.name);
    const nameTokens = tokenize(product.name);
    const normalizedDesc = normalizeText(product.description || '');
    let score = 0;
    let matchType: SearchResult['matchType'] = 'fuzzy';

    for (const eq of expandedQueries) {
      if (normalizedName === eq) {
        score = 1.0;
        matchType = 'exact';
        break;
      }
      if (normalizedName.includes(eq)) {
        if (score < 0.90) { score = 0.90; matchType = 'name'; }
      }
      const nn = normalizedName.replace(/-/g, ' ').replace(/\s+/g, ' ');
      const eqn = eq.replace(/-/g, ' ').replace(/\s+/g, ' ');
      if (nn.includes(eqn) || eqn.includes(nn)) {
        if (score < 0.88) { score = 0.88; matchType = 'name'; }
      }
      if (eq.includes(normalizedName) && normalizedName.length >= 3) {
        if (score < 0.85) { score = 0.85; matchType = 'name'; }
      }
      const qtm = tokenize(eq);
      const ntm = tokenize(normalizedName);
      if (qtm.some(qt => ntm.some(nt => qt === nt && qt.length >= 3))) {
        if (score < 0.82) { score = 0.82; matchType = 'name'; }
      }
    }

    if (score < 0.80 && matchInArray(product.search_keywords, queryTokens)) {
      score = 0.80;
      matchType = 'keyword';
    }
    if (score < 0.75 && matchInArray(product.ingredients, queryTokens)) {
      score = 0.75;
      matchType = 'ingredient';
    }
    if (score < 0.65) {
      for (const eq of expandedQueries) {
        if (normalizedDesc.includes(eq)) {
          score = 0.65;
          matchType = 'description';
          break;
        }
      }
    }
    if (score < 0.5) {
      const fs = fuzzyTokenMatch(queryTokens, nameTokens);
      if (fs > score) {
        score = fs;
        matchType = 'fuzzy';
      }
    }
    if (score < minSimilarity) {
      const overlap = queryTokens.some(qt => nameTokens.some(nt => nt.includes(qt) || qt.includes(nt)));
      if (overlap) score = Math.max(score, 0.35);
    }
    if (score >= minSimilarity) {
      scored.push({ product, similarity: score, matchType });
    }
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, maxResults);
}

/**
 * Paginated smart search - use when menu has many items.
 */
export function smartSearchProductsV2(
  products: Product[],
  query: string | undefined,
  category: string | undefined,
  synonyms: Synonym[] = [],
  options: SearchOptionsV2 = {}
): PaginatedSearchResult {
  const {
    maxResults = 10,
    offset = 0,
    includeUnavailable = false,
    minSimilarity = 0.3,
  } = options;

  const fetchLimit = Math.max(offset + maxResults, 50);
  const rawResults = smartSearchProductsInternal(
    products,
    query,
    category,
    synonyms,
    { maxResults: fetchLimit, includeUnavailable, minSimilarity }
  );

  const total = rawResults.length;
  const paginated = rawResults.slice(offset, offset + maxResults);

  return {
    results: paginated,
    total,
    offset,
    limit: maxResults,
    hasMore: offset + paginated.length < total,
  };
}
