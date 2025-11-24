import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, RefreshCw, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';

interface CheckItem {
  id: string;
  title: string;
  description: string;
  category: 'critical' | 'important' | 'optional';
  steps: string[];
}

const checklistItems: CheckItem[] = [
  {
    id: 'onboarding',
    title: 'Onboarding Flow',
    description: 'Complete restaurant setup process',
    category: 'critical',
    steps: [
      'Navigate to /onboarding',
      'Fill in restaurant information',
      'Set up menu categories and products',
      'Complete WhatsApp setup step',
      'Verify redirect to dashboard'
    ]
  },
  {
    id: 'whatsapp-connect',
    title: 'WhatsApp Connection',
    description: 'Connect and verify WhatsApp Business',
    category: 'critical',
    steps: [
      'Go to WhatsApp Connection page',
      'Click "Connect" button',
      'Scan QR code with WhatsApp',
      'Verify status shows "Connected"',
      'Check instance appears in Admin panel'
    ]
  },
  {
    id: 'order-flow',
    title: 'End-to-End Order via AI',
    description: 'Complete order flow through WhatsApp AI',
    category: 'critical',
    steps: [
      'Send test message via WhatsApp',
      'Verify AI responds with menu',
      'Add items to cart via conversation',
      'Provide delivery address',
      'Confirm payment method',
      'Complete order and verify in Dashboard'
    ]
  },
  {
    id: 'recovery-flow',
    title: 'Conversation Recovery',
    description: 'Test automated recovery messages',
    category: 'important',
    steps: [
      'Start a conversation but don\'t complete',
      'Wait for abandonment delay (30 min)',
      'Verify recovery message is sent',
      'Check conversation_recovery_attempts table',
      'Test opt-out functionality'
    ]
  },
  {
    id: 'chat-flow',
    title: 'Chat Message Flow',
    description: 'Manual messaging and real-time updates',
    category: 'important',
    steps: [
      'Go to Messages page',
      'Select a conversation',
      'Send a manual message',
      'Verify message appears in chat',
      'Check message is saved to database'
    ]
  },
  {
    id: 'dashboard-updates',
    title: 'Dashboard Real-Time Updates',
    description: 'Verify real-time order notifications',
    category: 'important',
    steps: [
      'Open Dashboard in browser',
      'Create new order via WhatsApp',
      'Verify toast notification appears',
      'Check sound alert plays (if enabled)',
      'Confirm order appears in list immediately'
    ]
  },
  {
    id: 'analytics',
    title: 'Analytics Dashboard',
    description: 'Verify metrics and charts',
    category: 'optional',
    steps: [
      'Navigate to Analytics page',
      'Check revenue metrics display',
      'Verify charts render correctly',
      'Test date range filters',
      'Check conversion rates calculation'
    ]
  },
  {
    id: 'customer-insights',
    title: 'Customer Insights',
    description: 'View customer data and profiles',
    category: 'optional',
    steps: [
      'Go to Customers page',
      'Search for a customer',
      'Open customer profile drawer',
      'Verify order history displays',
      'Check preferred items section'
    ]
  },
  {
    id: 'ai-settings',
    title: 'AI Configuration',
    description: 'Modify AI behavior and prompts',
    category: 'optional',
    steps: [
      'Navigate to AI Configuration',
      'Select agent (Orchestrator/Conversational)',
      'Modify a prompt block',
      'Save changes',
      'Test behavior via WhatsApp'
    ]
  }
];

export default function SystemCheck() {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const resetChecklist = () => {
    setCheckedItems({});
    toast.success('Checklist resetado');
  };

  const criticalItems = checklistItems.filter(item => item.category === 'critical');
  const importantItems = checklistItems.filter(item => item.category === 'important');
  const optionalItems = checklistItems.filter(item => item.category === 'optional');

  const criticalComplete = criticalItems.every(item => checkedItems[item.id]);
  const importantComplete = importantItems.every(item => checkedItems[item.id]);
  const totalChecked = Object.values(checkedItems).filter(Boolean).length;
  const totalItems = checklistItems.length;

  const getCategoryBadge = (category: CheckItem['category']) => {
    const config = {
      critical: { variant: 'destructive' as const, label: 'Crítico' },
      important: { variant: 'default' as const, label: 'Importante' },
      optional: { variant: 'secondary' as const, label: 'Opcional' }
    };
    const { variant, label } = config[category];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const renderCheckSection = (items: CheckItem[], title: string) => (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {items.map(item => (
        <Card key={item.id} className={checkedItems[item.id] ? 'border-primary/50 bg-primary/5' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <Checkbox
                  id={item.id}
                  checked={checkedItems[item.id]}
                  onCheckedChange={() => toggleCheck(item.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <label
                      htmlFor={item.id}
                      className="text-base font-medium leading-none cursor-pointer"
                    >
                      {item.title}
                    </label>
                    {getCategoryBadge(item.category)}
                  </div>
                  <CardDescription>{item.description}</CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleExpand(item.id)}
              >
                {expandedItems[item.id] ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          {expandedItems[item.id] && (
            <CardContent className="pt-0">
              <div className="ml-9 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Passos:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  {item.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">System Check</h1>
            <p className="text-muted-foreground">Manual validation checklist for critical workflows</p>
          </div>
        </div>
        <Button onClick={resetChecklist} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Progress Overview</CardTitle>
          <CardDescription>
            {totalChecked} of {totalItems} checks completed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Critical Flows</p>
              <div className="flex items-center gap-2">
                {criticalComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-2xl font-bold">
                  {criticalItems.filter(item => checkedItems[item.id]).length}/{criticalItems.length}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">Important Flows</p>
              <div className="flex items-center gap-2">
                {importantComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-2xl font-bold">
                  {importantItems.filter(item => checkedItems[item.id]).length}/{importantItems.length}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">Optional Flows</p>
              <div className="flex items-center gap-2">
                <Circle className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  {optionalItems.filter(item => checkedItems[item.id]).length}/{optionalItems.length}
                </span>
              </div>
            </div>
          </div>

          {criticalComplete && importantComplete && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-medium">All critical and important flows validated! ✅</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checklist Sections */}
      <div className="space-y-6">
        {renderCheckSection(criticalItems, '🔴 Critical Flows')}
        {renderCheckSection(importantItems, '🟡 Important Flows')}
        {renderCheckSection(optionalItems, '🟢 Optional Flows')}
      </div>

      {/* Footer Note */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> This is a manual testing checklist. Run through these flows after each deployment
            to ensure system reliability. For automated testing, see the test folder structure in the project.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
