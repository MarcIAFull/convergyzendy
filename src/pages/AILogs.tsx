import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Search, Filter, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface AILog {
  id: string;
  created_at: string;
  restaurant_id: string;
  customer_phone: string;
  user_message: string;
  state_before: string;
  state_after: string;
  orchestrator_intent: string;
  orchestrator_confidence: number;
  orchestrator_target_state: string;
  orchestrator_reasoning: string;
  context_loaded: any;
  system_prompt: string;
  prompt_length: number;
  ai_request: any;
  ai_response_raw: any;
  ai_response_text: string;
  tool_calls_requested: any[];
  tool_calls_validated: any[];
  tool_execution_results: any[];
  final_response: string;
  processing_time_ms: number;
  tokens_used: number;
  errors: any[];
  has_errors: boolean;
  log_level: string;
}

export default function AILogs() {
  const [selectedLog, setSelectedLog] = useState<AILog | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [phoneFilter, setPhoneFilter] = useState("");

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["ai-logs", searchQuery, intentFilter, onlyErrors, phoneFilter],
    queryFn: async () => {
      let query = supabase
        .from("ai_interaction_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (onlyErrors) {
        query = query.eq("has_errors", true);
      }

      if (intentFilter && intentFilter !== "all") {
        query = query.eq("orchestrator_intent", intentFilter);
      }

      if (phoneFilter) {
        query = query.ilike("customer_phone", `%${phoneFilter}%`);
      }

      if (searchQuery) {
        query = query.or(`user_message.ilike.%${searchQuery}%,final_response.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AILog[];
    },
  });

  const getStatusIcon = (log: AILog) => {
    if (log.has_errors) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    if (log.log_level === "warning") {
      return <AlertCircle className="h-4 w-4 text-warning" />;
    }
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  };

  const getStatusBadge = (log: AILog) => {
    if (log.has_errors) return <Badge variant="destructive">Error</Badge>;
    if (log.log_level === "warning") return <Badge variant="outline">Warning</Badge>;
    return <Badge variant="default">Success</Badge>;
  };

  const uniqueIntents = Array.from(
    new Set(logs?.map((log) => log.orchestrator_intent).filter(Boolean))
  );

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Interaction Logs</h2>
          <p className="text-muted-foreground">
            Comprehensive debugging logs for AI agent interactions
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Messages</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search in messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="Filter by phone..."
                value={phoneFilter}
                onChange={(e) => setPhoneFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="intent">Intent</Label>
              <Select value={intentFilter} onValueChange={setIntentFilter}>
                <SelectTrigger id="intent">
                  <SelectValue placeholder="All intents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All intents</SelectItem>
                  {uniqueIntents.map((intent) => (
                    <SelectItem key={intent} value={intent}>
                      {intent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 pt-8">
              <Switch
                id="errors-only"
                checked={onlyErrors}
                onCheckedChange={setOnlyErrors}
              />
              <Label htmlFor="errors-only">Errors Only</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Interactions ({logs?.length || 0})</CardTitle>
          <CardDescription>
            Click on any row to view detailed information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
          ) : logs && logs.length > 0 ? (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Intent</TableHead>
                    <TableHead>Tools</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Time (ms)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedLog(log);
                        setSheetOpen(true);
                      }}
                    >
                      <TableCell>{getStatusIcon(log)}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), "HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.customer_phone.slice(-4)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {log.user_message}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.orchestrator_intent}</Badge>
                      </TableCell>
                      <TableCell>
                        {log.tool_calls_validated?.length || 0}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.state_before} → {log.state_after}
                      </TableCell>
                      <TableCell>{log.processing_time_ms}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No logs found. Try adjusting your filters.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[800px] sm:max-w-[800px] overflow-y-auto">
          {selectedLog && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {getStatusIcon(selectedLog)}
                  Interaction Details
                </SheetTitle>
                <SheetDescription>
                  {format(new Date(selectedLog.created_at), "PPpp")}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <Accordion type="multiple" className="w-full">
                  {/* Original Message */}
                  <AccordionItem value="message">
                    <AccordionTrigger>📝 Original Message</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <div>
                        <Label>Phone</Label>
                        <p className="font-mono text-sm">{selectedLog.customer_phone}</p>
                      </div>
                      <div>
                        <Label>Message</Label>
                        <p className="text-sm bg-muted p-3 rounded-md">
                          {selectedLog.user_message}
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Orchestrator */}
                  <AccordionItem value="orchestrator">
                    <AccordionTrigger>🔍 Classification (Orchestrator)</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <div>
                        <Label>Intent</Label>
                        <p><Badge>{selectedLog.orchestrator_intent}</Badge></p>
                      </div>
                      <div>
                        <Label>Confidence</Label>
                        <p>{(selectedLog.orchestrator_confidence * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <Label>Target State</Label>
                        <p><Badge variant="outline">{selectedLog.orchestrator_target_state}</Badge></p>
                      </div>
                      <div>
                        <Label>Reasoning</Label>
                        <p className="text-sm bg-muted p-3 rounded-md">
                          {selectedLog.orchestrator_reasoning}
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Context */}
                  <AccordionItem value="context">
                    <AccordionTrigger>📦 Loaded Context</AccordionTrigger>
                    <AccordionContent>
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-[300px]">
                        {JSON.stringify(selectedLog.context_loaded, null, 2)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>

                  {/* System Prompt */}
                  <AccordionItem value="prompt">
                    <AccordionTrigger>📄 System Prompt ({selectedLog.prompt_length} chars)</AccordionTrigger>
                    <AccordionContent>
                      <ScrollArea className="h-[400px]">
                        <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap">
                          {selectedLog.system_prompt}
                        </pre>
                      </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>

                  {/* OpenAI Request */}
                  <AccordionItem value="request">
                    <AccordionTrigger>🤖 OpenAI Request</AccordionTrigger>
                    <AccordionContent>
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-[300px]">
                        {JSON.stringify(selectedLog.ai_request, null, 2)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>

                  {/* OpenAI Response */}
                  <AccordionItem value="response">
                    <AccordionTrigger>💬 OpenAI Response</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <div>
                        <Label>Response Text</Label>
                        <p className="text-sm bg-muted p-3 rounded-md">
                          {selectedLog.ai_response_text}
                        </p>
                      </div>
                      <div>
                        <Label>Raw Response</Label>
                        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-[300px]">
                          {JSON.stringify(selectedLog.ai_response_raw, null, 2)}
                        </pre>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Tool Execution */}
                  <AccordionItem value="tools">
                    <AccordionTrigger>
                      🔧 Tool Execution ({selectedLog.tool_calls_validated?.length || 0} tools)
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      {selectedLog.tool_calls_validated?.length > 0 ? (
                        selectedLog.tool_calls_validated.map((tool: any, idx: number) => (
                          <div key={idx} className="border rounded-md p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Tool: {tool.function?.name}</Label>
                              <Badge>Validated</Badge>
                            </div>
                            <div>
                              <Label className="text-xs">Arguments</Label>
                              <pre className="text-xs bg-muted p-2 rounded-md">
                                {JSON.stringify(JSON.parse(tool.function?.arguments || "{}"), null, 2)}
                              </pre>
                            </div>
                            {selectedLog.tool_execution_results?.[idx] && (
                              <div>
                                <Label className="text-xs">Result</Label>
                                <pre className="text-xs bg-muted p-2 rounded-md">
                                  {JSON.stringify(selectedLog.tool_execution_results[idx], null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No tools executed</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Final Response */}
                  <AccordionItem value="final">
                    <AccordionTrigger>📨 Final Response</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <div>
                        <Label>Message Sent</Label>
                        <p className="text-sm bg-muted p-3 rounded-md">
                          {selectedLog.final_response}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>State Transition</Label>
                          <p className="text-sm">
                            {selectedLog.state_before} → {selectedLog.state_after}
                          </p>
                        </div>
                        <div>
                          <Label>Processing Time</Label>
                          <p className="text-sm">{selectedLog.processing_time_ms}ms</p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Errors */}
                  {selectedLog.has_errors && (
                    <AccordionItem value="errors">
                      <AccordionTrigger className="text-destructive">
                        ❌ Errors
                      </AccordionTrigger>
                      <AccordionContent>
                        <pre className="text-xs bg-destructive/10 p-3 rounded-md overflow-auto max-h-[300px]">
                          {JSON.stringify(selectedLog.errors, null, 2)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
