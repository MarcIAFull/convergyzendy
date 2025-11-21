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
  
  set_delivery_address: {
    type: "function",
    function: {
      name: "set_delivery_address",
      description: "Set the delivery address for the order",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string",
            description: "Full delivery address"
          }
        },
        required: ["address"]
      }
    }
  },
  
  set_payment_method: {
    type: "function",
    function: {
      name: "set_payment_method",
      description: "Set the payment method for the order",
      parameters: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["cash", "card", "mbway"],
            description: "Payment method"
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
      description: "Clear all items from the customer's cart",
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
  
  add_pending_item: {
    type: "function",
    function: {
      name: "add_pending_item",
      description: "Add a product to pending items (not yet in cart, awaiting confirmation)",
      parameters: {
        type: "object",
        properties: {
          product_id: {
            type: "string",
            description: "UUID of the product"
          },
          quantity: {
            type: "number",
            description: "Quantity, default 1"
          },
          notes: {
            type: "string",
            description: "Optional notes"
          }
        },
        required: ["product_id"]
      }
    }
  },
  
  clear_pending_items: {
    type: "function",
    function: {
      name: "clear_pending_items",
      description: "Clear all pending items",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  
  confirm_pending_items: {
    type: "function",
    function: {
      name: "confirm_pending_items",
      description: "Move all pending items to the cart",
      parameters: {
        type: "object",
        properties: {}
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
  }
};

/**
 * Get a tool definition by name, returning base definition if not found
 */
export function getBaseToolDefinition(toolName: string): ToolDefinition | null {
  return BASE_TOOLS[toolName] || null;
}
