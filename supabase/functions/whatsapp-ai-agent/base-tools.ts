/**
 * Base Tool Definitions
 * 
 * Default tool schemas that can be overridden via agent_tools configuration
 */

export interface ToolDefinition {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export const BASE_TOOLS: Record<string, ToolDefinition> = {
  add_to_cart: {
    type: "function",
    function: {
      name: "add_to_cart",
      description: "Add a product to the customer's cart with optional addons",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description: "UUID of the product to add (from the product list)"
          },
          quantity: {
            type: "number",
            description: "Quantity to add, default 1"
          },
          addon_ids: {
            type: "array",
            items: { type: "string" },
            description: "Array of addon UUIDs to include with this product"
          },
          notes: {
            type: "string",
            description: "Optional special instructions or customizations that are NOT available as addons"
          }
        },
        required: ["product_id"]
      }
    }
  },
  
  remove_from_cart: {
    type: "function",
    function: {
      name: "remove_from_cart",
      description: "Remove a product from the customer's cart",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description: "UUID of the product to remove"
          }
        },
        required: ["product_id"]
      }
    }
  },
  
  validate_and_set_delivery_address: {
    type: "function",
    function: {
      name: "validate_and_set_delivery_address",
      description: "Validate and set the delivery address. Accepts either a text address (will geocode) OR direct GPS coordinates from WhatsApp location. Returns validation result with fee and estimated time. ALWAYS use this to set delivery address.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "Full delivery address (street, number, postal code, city) OR description/name from location"
          },
          latitude: {
            type: "number",
            description: "GPS latitude (optional - use when customer sends WhatsApp location)"
          },
          longitude: {
            type: "number",
            description: "GPS longitude (optional - use when customer sends WhatsApp location)"
          }
        },
        required: []
      }
    }
  },
  
  set_payment_method: {
    type: "function",
    function: {
      name: "set_payment_method",
      description: "Set the payment method for the order. Accepts common Portuguese terms: 'dinheiro'/'cash' → cash, 'cartão'/'multibanco'/'card' → card, 'mbway'/'mb way' → mbway",
      parameters: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["cash", "card", "mbway"],
            description: "Payment method - normalize customer input: dinheiro/cash→cash, cartão/multibanco/card→card, mbway→mbway"
          }
        },
        required: ["method"]
      }
    }
  },
  
  finalize_order: {
    type: "function",
    function: {
      name: "finalize_order",
      description: "Finalize and place the order",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  
  clear_cart: {
    type: "function",
    function: {
      name: "clear_cart",
      description: "Clear all items from the customer's cart. USE APENAS se o usuário explicitamente pedir para 'cancelar tudo', 'limpar o carrinho', 'começar do zero' ou similar. Para mudanças de quantidade ou remoção de itens específicos, use remove_from_cart ou remove_pending_item.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  
  update_customer_profile: {
    type: "function",
    function: {
      name: "update_customer_profile",
      description: "Update customer profile information (name, default address, default payment method)",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Customer's name"
          },
          default_address: {
            type: "object",
            description: "Default delivery address as JSON object"
          },
          default_payment_method: {
            type: "string",
            enum: ["cash", "card", "mbway"],
            description: "Default payment method"
          }
        }
      }
    }
  },
  
  show_cart: {
    type: "function",
    function: {
      name: "show_cart",
      description: "Display the current cart contents to the customer",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  
  search_menu: {
    type: "function",
    function: {
      name: "search_menu",
      description: "Search the menu for products by name, category, or description. Use when customer mentions generic terms (e.g., 'uma pizza', 'um doce'), typos (e.g., 'piza', 'briguadeiro'), or you can't find exact match.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search term: product name, category (pizza, doce, bebida), ingredient, or description"
          },
          category: {
            type: "string",
            description: "Optional: filter by category name to narrow results"
          },
          max_results: {
            type: "number",
            description: "Maximum number of results to return (default 5)"
          }
        },
        required: []
      }
    }
  },
  
  add_pending_item: {
    type: "function",
    function: {
      name: "add_pending_item",
      description: "Add a product to the pending items list (for multi-item orders or when confirmation is needed). Use when customer mentions 2+ products at once, or when intent is ambiguous.",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description: "UUID of the product to add to pending items"
          },
          quantity: {
            type: "number",
            description: "Quantity to add, default 1"
          },
          addon_ids: {
            type: "array",
            items: { type: "string" },
            description: "Array of addon UUIDs to include with this product"
          },
          notes: {
            type: "string",
            description: "Optional special instructions or customizations that are NOT available as addons"
          }
        },
        required: ["product_id"]
      }
    }
  },
  
  remove_pending_item: {
    type: "function",
    function: {
      name: "remove_pending_item",
      description: "Remove or modify a pending item before confirmation. Use when customer wants to remove/change items from pending list.",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description: "UUID of the pending product to remove or modify"
          },
          action: {
            type: "string",
            enum: ["remove_all", "decrease_quantity"],
            description: "Action to perform: 'remove_all' deletes the item completely, 'decrease_quantity' reduces quantity by 1"
          },
          quantity_change: {
            type: "number",
            description: "Optional: specific quantity to remove (default 1 for decrease_quantity)"
          }
        },
        required: ["product_id", "action"]
      }
    }
  },
  
  confirm_pending_items: {
    type: "function",
    function: {
      name: "confirm_pending_items",
      description: "Confirm and move all pending items to the cart. Use when customer explicitly confirms their multi-item selection.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  
  clear_pending_items: {
    type: "function",
    function: {
      name: "clear_pending_items",
      description: "Discard all pending items without adding them to cart. Use when customer wants to start over or cancel pending selection.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  
  // RAG: Customer History Tool
  get_customer_history: {
    type: "function",
    function: {
      name: "get_customer_history",
      description: "Retrieve customer's order history, preferences, and insights. Use when: 1) Starting conversation with returning customer to personalize, 2) Making product recommendations based on favorites, 3) Checking if customer is VIP/frequent for special treatment. Do NOT use for new customers or simple questions.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  
  // Tool to send menu link to customer
  send_menu_link: {
    type: "function",
    function: {
      name: "send_menu_link",
      description: "Send the restaurant's public menu link to the customer. Use when customer asks to see the menu online, wants a link to browse products, or would benefit from seeing the digital menu with images and prices.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  
  // Tool to get product addons
  get_product_addons: {
    type: "function",
    function: {
      name: "get_product_addons",
      description: "Get available addons (extras, borders, toppings) for a specific product. Use BEFORE add_to_cart when customer asks about customizations like 'quais bordas tem?', 'posso adicionar algo?', or when adding products that typically have addons (pizzas, hambúrgueres). Returns list of addon_ids that can be used in add_to_cart.",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description: "UUID of the product to get addons for"
          }
        },
        required: ["product_id"]
      }
    }
  },
  
  // Alias for backwards compatibility with database entries using old name
  set_delivery_address: {
    type: "function",
    function: {
      name: "validate_and_set_delivery_address",
      description: "Alias for validate_and_set_delivery_address. Validate and set the delivery address. Accepts text address OR GPS coordinates from WhatsApp location.",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "Full delivery address (street, number, postal code, city) OR description from location"
          },
          latitude: {
            type: "number",
            description: "GPS latitude (optional - use when customer sends WhatsApp location)"
          },
          longitude: {
            type: "number",
            description: "GPS longitude (optional - use when customer sends WhatsApp location)"
          }
        },
        required: []
      }
    }
  },
  
  // Tool to request human handoff
  request_human_handoff: {
    type: "function",
    function: {
      name: "request_human_handoff",
      description: "Transfere a conversa para atendimento humano. Use quando: 1) Cliente pede explicitamente para falar com humano/atendente/gerente. 2) Tom agressivo ou frustração clara. 3) IA não consegue resolver após múltiplas tentativas. 4) Situação requer julgamento humano.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            enum: ["customer_request", "aggressive_tone", "ai_limitation", "repeated_confusion"],
            description: "Motivo da transferência: customer_request (pedido explícito), aggressive_tone (cliente agressivo/frustrado), ai_limitation (IA não consegue resolver), repeated_confusion (confusão repetida)"
          },
          summary: {
            type: "string",
            description: "Resumo breve da situação para o atendente humano (max 200 chars)"
          }
        },
        required: ["reason"]
      }
    }
  }
};

/**
 * Get a tool definition by name, returning base definition if not found
 * Handles alias mapping for backwards compatibility
 */
export function getBaseToolDefinition(toolName: string): ToolDefinition | null {
  // Map old names to new names for backwards compatibility
  const aliasMap: Record<string, string> = {
    'set_delivery_address': 'validate_and_set_delivery_address'
  };
  
  const resolvedName = aliasMap[toolName] || toolName;
  return BASE_TOOLS[resolvedName] || BASE_TOOLS[toolName] || null;
}
