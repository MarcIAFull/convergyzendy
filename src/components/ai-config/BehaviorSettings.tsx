import { Agent } from '@/types/agent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

interface BehaviorSettingsProps {
  agent: Agent;
  onUpdate: (updates: Partial<Agent>) => void;
}

export function BehaviorSettings({ agent, onUpdate }: BehaviorSettingsProps) {
  const customerProfile = agent.behavior_config?.customer_profile || {};
  const pendingProducts = agent.behavior_config?.pending_products || {};

  const updateCustomerProfile = (field: string, value: boolean) => {
    onUpdate({
      behavior_config: {
        ...agent.behavior_config,
        customer_profile: {
          ...customerProfile,
          [field]: value
        }
      }
    });
  };

  const updatePendingProducts = (field: string, value: boolean | number) => {
    onUpdate({
      behavior_config: {
        ...agent.behavior_config,
        pending_products: {
          ...pendingProducts,
          [field]: value
        }
      }
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Customer Profile Behavior</CardTitle>
          <CardDescription>Configure how the agent handles customer data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="auto_load"
              checked={customerProfile.auto_load ?? true}
              onCheckedChange={(checked) => updateCustomerProfile('auto_load', !!checked)}
            />
            <Label htmlFor="auto_load" className="text-sm font-normal cursor-pointer">
              Auto-load customer profile by phone
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="update_name"
              checked={customerProfile.update_name_from_conversation ?? true}
              onCheckedChange={(checked) => updateCustomerProfile('update_name_from_conversation', !!checked)}
            />
            <Label htmlFor="update_name" className="text-sm font-normal cursor-pointer">
              Update name from conversation
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="update_address"
              checked={customerProfile.update_address_on_confirmation ?? true}
              onCheckedChange={(checked) => updateCustomerProfile('update_address_on_confirmation', !!checked)}
            />
            <Label htmlFor="update_address" className="text-sm font-normal cursor-pointer">
              Update default address when user sends a new one
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="update_payment"
              checked={customerProfile.update_payment_on_confirmation ?? true}
              onCheckedChange={(checked) => updateCustomerProfile('update_payment_on_confirmation', !!checked)}
            />
            <Label htmlFor="update_payment" className="text-sm font-normal cursor-pointer">
              Update default payment method when user confirms payment
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Products</CardTitle>
          <CardDescription>Configure pending items behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="allow_multiple"
              checked={pendingProducts.allow_multiple ?? true}
              onCheckedChange={(checked) => updatePendingProducts('allow_multiple', !!checked)}
            />
            <Label htmlFor="allow_multiple" className="text-sm font-normal cursor-pointer">
              Allow multiple pending items
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiration">Pending items expire after (minutes)</Label>
            <Input 
              id="expiration"
              type="number"
              value={pendingProducts.expiration_minutes ?? 15}
              onChange={(e) => updatePendingProducts('expiration_minutes', parseInt(e.target.value) || 15)}
              min={1}
              max={120}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
