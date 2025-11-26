/**
 * Product Detection Helper
 * 
 * Detects when the AI is actively offering a product to the customer
 * based on linguistic patterns in the response.
 */

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  category: string;
  addons?: any[];
}

/**
 * Detects if the AI response is offering a specific product.
 * 
 * Only returns a product if the AI is ACTIVELY OFFERING it, not just mentioning it.
 * 
 * Positive patterns (offering):
 * - "temos X", "temos a X", "temos o X"
 * - "X custa €...", "X é €..."
 * - "queres X?", "adicionar X?"
 * - "oferta X", "recomendo X"
 * 
 * Negative patterns (NOT offering):
 * - "não temos X"
 * - "X não está disponível"
 * - "X está indisponível"
 * - "sem X"
 * 
 * @param response The AI's response text
 * @param products List of available products
 * @returns The offered product or null
 */
export function detectOfferedProduct(response: string, products: Product[]): Product | null {
  if (!response || products.length === 0) return null;
  
  const lowerResponse = response.toLowerCase();
  
  // Check for negative patterns first - these override positive patterns
  const negativePatterns = [
    /não temos/i,
    /não está disponível/i,
    /indisponível/i,
    /sem o/i,
    /sem a/i,
    /esgotad/i,
    /acabou/i
  ];
  
  for (const pattern of negativePatterns) {
    if (pattern.test(lowerResponse)) {
      console.log('[Product Detection] Negative pattern found, skipping detection');
      return null;
    }
  }
  
  // Look for products mentioned with offering patterns
  for (const product of products) {
    // Skip null/invalid products
    if (!product || !product.name) continue;
    
    const productName = product.name.toLowerCase();
    
    // Skip if product name not mentioned at all
    if (!lowerResponse.includes(productName)) continue;
    
    // Positive offering patterns (Portuguese)
    const offeringPatterns = [
      // "we have X"
      new RegExp(`temos\\s+(a|o)?\\s*${escapeRegex(productName)}`, 'i'),
      
      // "X costs €..." or "X is €..."
      new RegExp(`${escapeRegex(productName)}\\s+(custa|é|por)\\s*€`, 'i'),
      
      // "do you want X?" or "add X?"
      new RegExp(`(queres|quer|adicionar)\\s+(a|o)?\\s*${escapeRegex(productName)}`, 'i'),
      
      // "I recommend X", "we offer X"
      new RegExp(`(recomendo|ofereço|oferecemos|sugerimos)\\s+(a|o)?\\s*${escapeRegex(productName)}`, 'i'),
      
      // Price mention near product name (within 20 chars)
      // This catches "Pizza Margherita por €9.98" or similar
      new RegExp(`${escapeRegex(productName)}.{0,20}€\\d+`, 'i')
    ];
    
    // Check if any offering pattern matches
    for (const pattern of offeringPatterns) {
      if (pattern.test(lowerResponse)) {
        console.log(`[Product Detection] ✅ Detected offer: ${product.name}`);
        console.log(`[Product Detection] Pattern matched: ${pattern.source}`);
        return product;
      }
    }
  }
  
  console.log('[Product Detection] No product offer detected');
  return null;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
