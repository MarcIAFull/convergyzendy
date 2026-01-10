import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Bot, 
  MapPin, 
  Bell, 
  BarChart3, 
  Users, 
  ShoppingCart,
  Zap,
  Shield,
  Clock,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Star,
  Globe,
  Smartphone,
  ChefHat,
  Utensils,
  Target,
  RefreshCw,
  CreditCard,
  Menu
} from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const Landing = () => {
  const features = [
    {
      icon: Bot,
      title: "IA Conversacional Avançada",
      description: "Atendente virtual que entende linguagem natural, faz upsell inteligente e fecha pedidos automaticamente.",
      benefits: ["GPT-4 Turbo", "Personalização por restaurante", "Aprende com cada interação"]
    },
    {
      icon: MessageSquare,
      title: "WhatsApp Nativo",
      description: "Integração direta com WhatsApp Business. Seus clientes pedem onde já estão.",
      benefits: ["QR Code setup em 2 minutos", "Reconexão automática", "Múltiplas instâncias"]
    },
    {
      icon: Menu,
      title: "Menu Público Online",
      description: "Cardápio digital completo com sua marca. Clientes fazem pedidos direto pelo navegador.",
      benefits: ["Link personalizado (seurestaurante.zendy.ai)", "Checkout web completo", "SEO otimizado"]
    },
    {
      icon: MapPin,
      title: "Zonas de Entrega Inteligentes",
      description: "Defina áreas de entrega com taxas automáticas baseadas em geolocalização.",
      benefits: ["Validação de endereço em tempo real", "Taxas dinâmicas por zona", "Mínimo de pedido por região"]
    },
    {
      icon: RefreshCw,
      title: "Recuperação de Vendas",
      description: "Recupere carrinhos abandonados e conversas pausadas automaticamente.",
      benefits: ["Carrinhos abandonados (30min)", "Conversas pausadas (15min)", "Reengajamento de clientes inativos"]
    },
    {
      icon: BarChart3,
      title: "Analytics em Tempo Real",
      description: "Dashboard completo com métricas de vendas, performance e insights de clientes.",
      benefits: ["Receita por período", "Produtos mais vendidos", "Taxa de conversão"]
    },
    {
      icon: Users,
      title: "Gestão de Clientes",
      description: "Perfis completos com histórico de pedidos, preferências e insights personalizados.",
      benefits: ["Histórico completo", "Preferências salvas", "Recomendações automáticas"]
    }
  ];

  const benefits = [
    {
      icon: Clock,
      title: "Economize 40h/mês",
      description: "Automatize atendimento e reduza drasticamente o tempo gasto respondendo mensagens."
    },
    {
      icon: TrendingUp,
      title: "Aumente vendas em 35%",
      description: "IA proativa que faz upsell no momento certo e recupera vendas perdidas."
    },
    {
      icon: Shield,
      title: "Zero erros de pedido",
      description: "Sistema valida cada item, endereço e pagamento antes de confirmar."
    },
    {
      icon: Zap,
      title: "Atendimento 24/7",
      description: "Nunca perca um pedido. IA disponível mesmo quando você está dormindo."
    }
  ];

  const testimonials = [
    {
      name: "Carlos Silva",
      business: "Pizzaria do Bairro",
      quote: "Triplicamos nossos pedidos noturnos. A IA atende melhor que muito funcionário!",
      rating: 5
    },
    {
      name: "Ana Costa",
      business: "Açaí da Ana",
      quote: "A recuperação de carrinhos me trouxe R$3.000 extras no primeiro mês.",
      rating: 5
    },
    {
      name: "Pedro Santos",
      business: "Burger House",
      quote: "Setup em 15 minutos. No mesmo dia já estava recebendo pedidos via WhatsApp.",
      rating: 5
    }
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "97",
      description: "Perfeito para começar",
      features: [
        "Até 200 pedidos/mês",
        "1 usuário",
        "IA Conversacional",
        "Integração WhatsApp",
        "Dashboard básico"
      ],
      highlighted: false
    },
    {
      name: "Professional",
      price: "197",
      description: "Mais popular",
      features: [
        "Até 1.000 pedidos/mês",
        "5 usuários",
        "Tudo do Starter +",
        "Zonas de entrega ilimitadas",
        "Recuperação de vendas",
        "Analytics avançado",
        "Suporte prioritário"
      ],
      highlighted: true
    },
    {
      name: "Enterprise",
      price: "397",
      description: "Para grandes operações",
      features: [
        "Pedidos ilimitados",
        "Usuários ilimitados",
        "Tudo do Professional +",
        "API personalizada",
        "Múltiplas unidades",
        "Gerente de conta dedicado",
        "SLA garantido"
      ],
      highlighted: false
    }
  ];

  return (
    <>
      <Helmet>
        <title>Zendy AI - Sistema Inteligente de Pedidos via WhatsApp para Restaurantes</title>
        <meta name="description" content="Automatize pedidos do seu restaurante com IA conversacional no WhatsApp. Aumente vendas em 35%, economize 40h/mês e atenda 24/7." />
        <meta name="keywords" content="pedidos whatsapp, delivery restaurante, ia restaurante, chatbot delivery, sistema pedidos" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-foreground">Zendy AI</span>
              </div>
              <div className="hidden md:flex items-center gap-8">
                <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Funcionalidades</a>
                <a href="#benefits" className="text-muted-foreground hover:text-foreground transition-colors">Benefícios</a>
                <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Preços</a>
                <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">Depoimentos</a>
              </div>
              <div className="flex items-center gap-3">
                <Link to="/login">
                  <Button variant="outline">Área do Cliente</Button>
                </Link>
                <Link to="/login">
                  <Button className="gradient-primary text-white border-0 hover:opacity-90">
                    Começar Grátis
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-background to-red-50 dark:from-orange-950/20 dark:via-background dark:to-red-950/20" />
          <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-destructive/10 rounded-full blur-3xl" />
          
          <div className="max-w-7xl mx-auto relative">
            <div className="text-center max-w-4xl mx-auto">
              <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                <Zap className="w-3 h-3 mr-1" />
                Powered by GPT-4 Turbo
              </Badge>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
                Seu restaurante vendendo{" "}
                <span className="bg-gradient-to-r from-primary to-destructive bg-clip-text text-transparent">
                  24 horas por dia
                </span>{" "}
                no WhatsApp
              </h1>
              
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                IA conversacional que atende, vende e fecha pedidos automaticamente. 
                Enquanto você dorme, o Zendy trabalha.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                <Link to="/login">
                  <Button size="lg" className="gradient-primary text-white border-0 hover:opacity-90 text-lg px-8 py-6 h-auto">
                    Começar Teste Grátis
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <a 
                  href="https://wa.me/351915817565?text=Ol%C3%A1!%20Quero%20ver%20uma%20demonstra%C3%A7%C3%A3o%20do%20Zendy%20AI" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Button size="lg" variant="outline" className="text-lg px-8 py-6 h-auto">
                    <MessageSquare className="mr-2 w-5 h-5" />
                    Ver Demo ao Vivo
                  </Button>
                </a>
              </div>
              
              <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Setup em 15 minutos</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Sem cartão de crédito</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Cancele quando quiser</span>
                </div>
              </div>
            </div>

            {/* Hero Image/Demo */}
            <div className="mt-16 relative">
              <div className="bg-card rounded-2xl shadow-2xl border border-border overflow-hidden max-w-5xl mx-auto">
                <div className="bg-muted/50 px-4 py-3 flex items-center gap-2 border-b border-border">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  <div className="w-3 h-3 rounded-full bg-success" />
                </div>
                <div className="p-8 grid md:grid-cols-2 gap-8">
                  {/* WhatsApp Chat Preview */}
                  <div className="bg-[#0b141a] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-destructive flex items-center justify-center">
                        <ChefHat className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">Pizzaria Famiglia</p>
                        <p className="text-green-400 text-xs">Online agora</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-[#005c4b] text-white text-sm p-3 rounded-lg rounded-tr-none max-w-[80%] ml-auto">
                        Oi! Quero uma pizza grande
                      </div>
                      <div className="bg-[#202c33] text-white text-sm p-3 rounded-lg rounded-tl-none max-w-[80%]">
                        Olá! 🍕 Temos várias opções deliciosas! As mais pedidas são:
                        <br /><br />
                        • Margherita - €12,90<br />
                        • Calabresa - €14,90<br />
                        • 4 Queijos - €16,90<br />
                        <br />
                        Qual vai ser? 😋
                      </div>
                      <div className="bg-[#005c4b] text-white text-sm p-3 rounded-lg rounded-tr-none max-w-[80%] ml-auto">
                        Calabresa! E uma coca
                      </div>
                      <div className="bg-[#202c33] text-white text-sm p-3 rounded-lg rounded-tl-none max-w-[80%]">
                        Boa escolha! 🔥 Anotei:<br />
                        • 1x Pizza Calabresa - €14,90<br />
                        • 1x Coca-Cola 2L - €6,00<br /><br />
                        Total: €20,90<br /><br />
                        Pra onde eu mando essa delícia?
                      </div>
                    </div>
                  </div>

                  {/* Dashboard Preview */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-green-600 dark:text-green-400">Vendas Hoje</p>
                              <p className="text-2xl font-bold text-green-700 dark:text-green-300">€1.247</p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-green-500" />
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-primary/5 border-primary/20">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-primary">Pedidos</p>
                              <p className="text-2xl font-bold text-primary">47</p>
                            </div>
                            <ShoppingCart className="w-8 h-8 text-primary" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm font-medium mb-3">Últimos Pedidos</p>
                        <div className="space-y-2">
                          {[
                            { name: "João Silva", items: "2x Pizza, 1x Refri", total: "€32,80", status: "Em preparo" },
                            { name: "Maria Costa", items: "1x Açaí 500ml", total: "€18,90", status: "Saiu p/ entrega" },
                            { name: "Pedro Santos", items: "1x Hambúrguer", total: "€24,50", status: "Entregue" }
                          ].map((order, i) => (
                            <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                              <div>
                                <p className="text-sm font-medium">{order.name}</p>
                                <p className="text-xs text-muted-foreground">{order.items}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">{order.total}</p>
                                <Badge variant="secondary" className="text-xs">{order.status}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Logos Section */}
        <section className="py-12 border-y border-border bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-muted-foreground mb-8">Tecnologias que impulsionam o Zendy</p>
            <div className="flex items-center justify-center gap-12 opacity-60">
              <div className="flex items-center gap-2">
                <Bot className="w-6 h-6" />
                <span className="font-semibold">OpenAI</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-6 h-6" />
                <span className="font-semibold">WhatsApp</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-6 h-6" />
                <span className="font-semibold">Supabase</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-6 h-6" />
                <span className="font-semibold">Google Maps</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Funcionalidades</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Tudo que seu delivery precisa em um só lugar
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Do primeiro contato ao pedido entregue, automatize cada etapa do seu atendimento.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/50">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground mb-4">{feature.description}</p>
                    <ul className="space-y-2">
                      {feature.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">Resultados Reais</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Por que restaurantes escolhem o Zendy?
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Números que falam por si. Nossos clientes veem resultados desde o primeiro mês.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {benefits.map((benefit, index) => (
                <Card key={index} className="text-center border-border/50 hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <benefit.icon className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">{benefit.title}</h3>
                    <p className="text-muted-foreground text-sm">{benefit.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Como Funciona</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Comece a vender em 3 passos simples
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  icon: Smartphone,
                  title: "Conecte seu WhatsApp",
                  description: "Escaneie o QR Code e conecte seu número comercial em segundos."
                },
                {
                  step: "2",
                  icon: Menu,
                  title: "Configure seu cardápio",
                  description: "Adicione produtos, preços e zonas de entrega no painel intuitivo."
                },
                {
                  step: "3",
                  icon: Target,
                  title: "Comece a vender",
                  description: "A IA assume o atendimento e você foca em preparar os pedidos."
                }
              ].map((item, index) => (
                <div key={index} className="relative">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                      {item.step}
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </div>
                  {index < 2 && (
                    <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary to-transparent" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800">
                <Star className="w-3 h-3 mr-1 fill-current" />
                Depoimentos
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                O que nossos clientes dizem
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <Card key={index} className="border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-1 mb-4">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star key={i} className="w-5 h-5 text-yellow-500 fill-current" />
                      ))}
                    </div>
                    <p className="text-foreground mb-4 italic">"{testimonial.quote}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-primary font-semibold">{testimonial.name[0]}</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{testimonial.name}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.business}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Preços</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Planos que cabem no seu bolso
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Comece com teste grátis de 14 dias. Sem compromisso.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {pricingPlans.map((plan, index) => (
                <Card 
                  key={index} 
                  className={`relative ${plan.highlighted ? 'border-primary shadow-xl scale-105' : 'border-border/50'}`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge className="gradient-primary text-white border-0">Mais Popular</Badge>
                    </div>
                  )}
                  <CardContent className="p-6">
                    <h3 className="text-xl font-semibold text-foreground mb-2">{plan.name}</h3>
                    <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-foreground">€{plan.price}</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="text-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link to="/login">
                      <Button 
                        className={`w-full ${plan.highlighted ? 'gradient-primary text-white border-0' : ''}`}
                        variant={plan.highlighted ? "default" : "outline"}
                      >
                        Começar Agora
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          <div className="absolute inset-0 gradient-primary opacity-90" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
          
          <div className="max-w-4xl mx-auto text-center relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Pronto para revolucionar seu delivery?
            </h2>
            <p className="text-xl text-white/80 mb-8">
              Junte-se a centenas de restaurantes que já automatizaram seu atendimento.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/login">
                <Button size="lg" variant="secondary" className="text-lg px-8 py-6 h-auto">
                  Começar Teste Grátis de 14 Dias
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-white/60 text-sm">
              Sem cartão de crédito • Setup em minutos • Suporte incluído
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xl font-bold text-foreground">Zendy AI</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Sistema inteligente de pedidos via WhatsApp para restaurantes.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4">Produto</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a></li>
                  <li><a href="#pricing" className="hover:text-foreground transition-colors">Preços</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Integrações</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">API</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4">Suporte</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground transition-colors">Documentação</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Central de Ajuda</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Contato</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Status</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Privacidade</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">LGPD</a></li>
                </ul>
              </div>
            </div>
            <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                © 2024 Zendy AI. Todos os direitos reservados.
              </p>
              <div className="flex items-center gap-4">
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                </a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Landing;
