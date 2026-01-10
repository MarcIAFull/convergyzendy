import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Search, Filter, CheckCircle2, AlertCircle, XCircle, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

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

const EXPORT_FIELDS = [
  { key: "id", label: "ID" },
  { key: "created_at", label: "Data/Hora" },
  { key: "restaurant_id", label: "ID Restaurante" },
  { key: "customer_phone", label: "Telefone" },
  { key: "user_message", label: "Mensagem do Utilizador" },
  { key: "state_before", label: "Estado Anterior" },
  { key: "state_after", label: "Estado Posterior" },
  { key: "orchestrator_intent", label: "Intenção" },
  { key: "orchestrator_confidence", label: "Confiança" },
  { key: "orchestrator_target_state", label: "Estado Alvo" },
  { key: "orchestrator_reasoning", label: "Raciocínio" },
  { key: "context_loaded", label: "Contexto" },
  { key: "system_prompt", label: "Prompt do Sistema" },
  { key: "prompt_length", label: "Tamanho do Prompt" },
  { key: "ai_request", label: "Pedido IA" },
  { key: "ai_response_raw", label: "Resposta IA (Bruto)" },
  { key: "ai_response_text", label: "Resposta IA (Texto)" },
  { key: "tool_calls_requested", label: "Ferramentas Pedidas" },
  { key: "tool_calls_validated", label: "Ferramentas Validadas" },
  { key: "tool_execution_results", label: "Resultados das Ferramentas" },
  { key: "final_response", label: "Resposta Final" },
  { key: "processing_time_ms", label: "Tempo de Processamento" },
  { key: "tokens_used", label: "Tokens Utilizados" },
  { key: "errors", label: "Erros" },
  { key: "has_errors", label: "Tem Erros" },
  { key: "log_level", label: "Nível de Log" },
];

export default function AILogs() {
  const [selectedLog, setSelectedLog] = useState<AILog | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [phoneFilter, setPhoneFilter] = useState("");
  const [restaurantFilter, setRestaurantFilter] = useState<string>("all");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedExportFields, setSelectedExportFields] = useState<string[]>(
    EXPORT_FIELDS.map(f => f.key)
  );
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());

  // Fetch restaurants
  const { data: restaurants } = useQuery({
    queryKey: ["restaurants-for-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["ai-logs", searchQuery, intentFilter, onlyErrors, phoneFilter, restaurantFilter],
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

      if (restaurantFilter && restaurantFilter !== "all") {
        query = query.eq("restaurant_id", restaurantFilter);
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
    if (log.has_errors) return <Badge variant="destructive">Erro</Badge>;
    if (log.log_level === "warning") return <Badge variant="outline">Aviso</Badge>;
    return <Badge variant="default">Sucesso</Badge>;
  };

  const uniqueIntents = Array.from(
    new Set(logs?.map((log) => log.orchestrator_intent).filter(Boolean))
  );

  const toggleLogSelection = (logId: string) => {
    setSelectedLogIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const selectAllLogs = () => {
    if (logs) {
      setSelectedLogIds(new Set(logs.map(log => log.id)));
    }
  };

  const deselectAllLogs = () => {
    setSelectedLogIds(new Set());
  };

  const toggleExportField = (fieldKey: string) => {
    setSelectedExportFields(prev =>
      prev.includes(fieldKey)
        ? prev.filter(k => k !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const selectAllExportFields = () => {
    setSelectedExportFields(EXPORT_FIELDS.map(f => f.key));
  };

  const deselectAllExportFields = () => {
    setSelectedExportFields([]);
  };

  const exportLogsAsJson = () => {
    if (!logs || logs.length === 0) return;
    
    // Filter logs to only include selected ones
    const logsToExport = selectedLogIds.size > 0 
      ? logs.filter(log => selectedLogIds.has(log.id))
      : logs;
    
    // Filter logs to only include selected fields
    const filteredLogs = logsToExport.map(log => {
      const filtered: any = {};
      selectedExportFields.forEach(field => {
        filtered[field] = (log as any)[field];
      });
      return filtered;
    });
    
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-logs-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setExportDialogOpen(false);
  };

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Logs de Interação IA</h2>
          <p className="text-muted-foreground text-sm md:text-base">
            Logs de depuração das interações do agente de IA
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!logs || logs.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Exportar JSON</span>
                <span className="sm:hidden">Exportar</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configurar Exportação</DialogTitle>
                <DialogDescription>
                  {selectedLogIds.size > 0 
                    ? `A exportar ${selectedLogIds.size} de ${logs?.length || 0} logs selecionados`
                    : `A exportar todos os ${logs?.length || 0} logs (nenhum selecionado especificamente)`
                  }
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Seleção de Campos */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Campos a Exportar</Label>
                    <div className="flex gap-2">
                      <Button 
                        onClick={selectAllExportFields} 
                        variant="outline" 
                        size="sm"
                      >
                        Todos
                      </Button>
                      <Button 
                        onClick={deselectAllExportFields} 
                        variant="outline" 
                        size="sm"
                      >
                        Nenhum
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="h-[200px] border rounded-md p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {EXPORT_FIELDS.map(field => (
                        <div key={field.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={`export-${field.key}`}
                            checked={selectedExportFields.includes(field.key)}
                            onCheckedChange={() => toggleExportField(field.key)}
                          />
                          <Label 
                            htmlFor={`export-${field.key}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {field.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Info sobre logs selecionados */}
                {selectedLogIds.size > 0 && (
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm text-muted-foreground">
                      💡 <strong>{selectedLogIds.size} logs</strong> selecionados na tabela serão exportados. 
                      Para exportar todos, desmarque os logs na tabela.
                    </p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => setExportDialogOpen(false)}
                    className="w-full sm:w-auto"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={exportLogsAsJson}
                    disabled={selectedExportFields.length === 0}
                    className="w-full sm:w-auto"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar {selectedLogIds.size > 0 ? `(${selectedLogIds.size} logs)` : '(Todos)'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="search">Pesquisar Mensagens</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Pesquisar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="restaurant">Restaurante</Label>
              <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
                <SelectTrigger id="restaurant">
                  <SelectValue placeholder="Todos restaurantes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos restaurantes</SelectItem>
                  {restaurants?.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                placeholder="Filtrar por telefone..."
                value={phoneFilter}
                onChange={(e) => setPhoneFilter(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="intent">Intenção</Label>
              <Select value={intentFilter} onValueChange={setIntentFilter}>
                <SelectTrigger id="intent">
                  <SelectValue placeholder="Todas as intenções" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as intenções</SelectItem>
                  {uniqueIntents.map((intent) => (
                    <SelectItem key={intent} value={intent}>
                      {intent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2 pt-6 sm:pt-8">
              <Switch
                id="errors-only"
                checked={onlyErrors}
                onCheckedChange={setOnlyErrors}
              />
              <Label htmlFor="errors-only">Apenas Erros</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Interações ({logs?.length || 0})</CardTitle>
              <CardDescription>
                {selectedLogIds.size > 0 
                  ? `${selectedLogIds.size} logs selecionados para exportação`
                  : "Selecione logs para exportar ou clique numa linha para ver detalhes"
                }
              </CardDescription>
            </div>
            {logs && logs.length > 0 && (
              <div className="flex gap-2">
                <Button 
                  onClick={selectAllLogs} 
                  variant="outline" 
                  size="sm"
                >
                  Selecionar Todos
                </Button>
                <Button 
                  onClick={deselectAllLogs} 
                  variant="outline" 
                  size="sm"
                  disabled={selectedLogIds.size === 0}
                >
                  Desmarcar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">A carregar logs...</div>
          ) : logs && logs.length > 0 ? (
            <ScrollArea className="h-[400px] md:h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedLogIds.size === logs.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            selectAllLogs();
                          } else {
                            deselectAllLogs();
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead className="hidden md:table-cell">Telefone</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead className="hidden lg:table-cell">Intenção</TableHead>
                    <TableHead className="hidden lg:table-cell">Ferramentas</TableHead>
                    <TableHead className="hidden xl:table-cell">Transição</TableHead>
                    <TableHead className="hidden md:table-cell">Tempo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow
                      key={log.id}
                      className="hover:bg-muted/50"
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedLogIds.has(log.id)}
                          onCheckedChange={() => toggleLogSelection(log.id)}
                        />
                      </TableCell>
                      <TableCell
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedLog(log);
                          setSheetOpen(true);
                        }}
                      >
                        {getStatusIcon(log)}
                      </TableCell>
                      <TableCell 
                        className="text-sm cursor-pointer"
                        onClick={() => {
                          setSelectedLog(log);
                          setSheetOpen(true);
                        }}
                      >
                        {format(new Date(log.created_at), "HH:mm:ss")}
                      </TableCell>
                      <TableCell 
                        className="font-mono text-xs cursor-pointer hidden md:table-cell"
                        onClick={() => {
                          setSelectedLog(log);
                          setSheetOpen(true);
                        }}
                      >
                        {log.customer_phone.slice(-4)}
                      </TableCell>
                      <TableCell 
                        className="max-w-[100px] md:max-w-[200px] truncate cursor-pointer"
                        onClick={() => {
                          setSelectedLog(log);
                          setSheetOpen(true);
                        }}
                      >
                        {log.user_message}
                      </TableCell>
                      <TableCell
                        className="cursor-pointer hidden lg:table-cell"
                        onClick={() => {
                          setSelectedLog(log);
                          setSheetOpen(true);
                        }}
                      >
                        <Badge variant="outline">{log.orchestrator_intent}</Badge>
                      </TableCell>
                      <TableCell
                        className="cursor-pointer hidden lg:table-cell"
                        onClick={() => {
                          setSelectedLog(log);
                          setSheetOpen(true);
                        }}
                      >
                        {log.tool_calls_validated?.length || 0}
                      </TableCell>
                      <TableCell 
                        className="text-xs cursor-pointer hidden xl:table-cell"
                        onClick={() => {
                          setSelectedLog(log);
                          setSheetOpen(true);
                        }}
                      >
                        {log.state_before} → {log.state_after}
                      </TableCell>
                      <TableCell
                        className="cursor-pointer hidden md:table-cell"
                        onClick={() => {
                          setSelectedLog(log);
                          setSheetOpen(true);
                        }}
                      >
                        {log.processing_time_ms}ms
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum log encontrado. Tente ajustar os filtros.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:w-[600px] md:w-[800px] sm:max-w-[800px] overflow-y-auto">
          {selectedLog && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {getStatusIcon(selectedLog)}
                  Detalhes da Interação
                </SheetTitle>
                <SheetDescription>
                  {format(new Date(selectedLog.created_at), "PPpp", { locale: pt })}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <Accordion type="multiple" className="w-full">
                  {/* Original Message */}
                  <AccordionItem value="message">
                    <AccordionTrigger>📝 Mensagem Original</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <div>
                        <Label>Telefone</Label>
                        <p className="font-mono text-sm">{selectedLog.customer_phone}</p>
                      </div>
                      <div>
                        <Label>Mensagem</Label>
                        <p className="text-sm bg-muted p-3 rounded-md">
                          {selectedLog.user_message}
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Orchestrator */}
                  <AccordionItem value="orchestrator">
                    <AccordionTrigger>🔍 Classificação (Orquestrador)</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <div>
                        <Label>Intenção</Label>
                        <p><Badge>{selectedLog.orchestrator_intent}</Badge></p>
                      </div>
                      <div>
                        <Label>Confiança</Label>
                        <p>{(selectedLog.orchestrator_confidence * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <Label>Estado Alvo</Label>
                        <p><Badge variant="outline">{selectedLog.orchestrator_target_state}</Badge></p>
                      </div>
                      <div>
                        <Label>Raciocínio</Label>
                        <p className="text-sm bg-muted p-3 rounded-md">
                          {selectedLog.orchestrator_reasoning}
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Context */}
                  <AccordionItem value="context">
                    <AccordionTrigger>📦 Contexto Carregado</AccordionTrigger>
                    <AccordionContent>
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-[300px]">
                        {JSON.stringify(selectedLog.context_loaded, null, 2)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>

                  {/* System Prompt */}
                  <AccordionItem value="prompt">
                    <AccordionTrigger>📄 Prompt do Sistema ({selectedLog.prompt_length} caracteres)</AccordionTrigger>
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
                    <AccordionTrigger>🤖 Pedido à OpenAI</AccordionTrigger>
                    <AccordionContent>
                      <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-[300px]">
                        {JSON.stringify(selectedLog.ai_request, null, 2)}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>

                  {/* OpenAI Response */}
                  <AccordionItem value="response">
                    <AccordionTrigger>💬 Resposta da OpenAI</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <div>
                        <Label>Texto da Resposta</Label>
                        <p className="text-sm bg-muted p-3 rounded-md">
                          {selectedLog.ai_response_text}
                        </p>
                      </div>
                      <div>
                        <Label>Resposta Bruta</Label>
                        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-[300px]">
                          {JSON.stringify(selectedLog.ai_response_raw, null, 2)}
                        </pre>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Tool Execution */}
                  <AccordionItem value="tools">
                    <AccordionTrigger>
                      🔧 Execução de Ferramentas ({selectedLog.tool_calls_validated?.length || 0} ferramentas)
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      {selectedLog.tool_calls_validated?.length > 0 ? (
                        selectedLog.tool_calls_validated.map((tool: any, idx: number) => (
                          <div key={idx} className="border rounded-md p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Ferramenta: {tool.function?.name}</Label>
                              <Badge>Validada</Badge>
                            </div>
                            <div>
                              <Label className="text-xs">Argumentos</Label>
                              <pre className="text-xs bg-muted p-2 rounded-md">
                                {JSON.stringify(JSON.parse(tool.function?.arguments || "{}"), null, 2)}
                              </pre>
                            </div>
                            {selectedLog.tool_execution_results?.[idx] && (
                              <div>
                                <Label className="text-xs">Resultado</Label>
                                <pre className="text-xs bg-muted p-2 rounded-md">
                                  {JSON.stringify(selectedLog.tool_execution_results[idx], null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhuma ferramenta executada</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Final Response */}
                  <AccordionItem value="final">
                    <AccordionTrigger>📨 Resposta Final</AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <div>
                        <Label>Mensagem Enviada</Label>
                        <p className="text-sm bg-muted p-3 rounded-md">
                          {selectedLog.final_response}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>Transição de Estado</Label>
                          <p className="text-sm">
                            {selectedLog.state_before} → {selectedLog.state_after}
                          </p>
                        </div>
                        <div>
                          <Label>Tempo de Processamento</Label>
                          <p className="text-sm">{selectedLog.processing_time_ms}ms</p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Errors */}
                  {selectedLog.has_errors && (
                    <AccordionItem value="errors">
                      <AccordionTrigger className="text-destructive">
                        ❌ Erros
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