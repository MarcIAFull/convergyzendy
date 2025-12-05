-- Add GPS location instructions to conversational AI prompt
-- Insert a new prompt block specifically for GPS location handling

INSERT INTO agent_prompt_blocks (agent_id, title, content, ordering, is_locked)
SELECT 
  id,
  'GPS Location Handling',
  E'## Localizações GPS do WhatsApp\nQuando o cliente enviar uma localização pelo WhatsApp, a mensagem virá no formato:\n`[LOCALIZAÇÃO GPS: lat=XX.XXXXX, lng=YY.YYYYY, nome="...", endereço="..."]`\n\nAção OBRIGATÓRIA:\n1. EXTRAIA latitude e longitude da mensagem\n2. Chame validate_and_set_delivery_address COM os parâmetros latitude e longitude\n3. Use o nome/endereço da localização (se existir) como descrição\n\nExemplo:\nMensagem: "[LOCALIZAÇÃO GPS: lat=37.0724302, lng=-8.1058905, nome=Minha Casa]"\nAção: validate_and_set_delivery_address(latitude=37.0724302, longitude=-8.1058905, address="Minha Casa")\n\nIMPORTANTE: Localizações GPS são precisas e não precisam de geocoding - use as coordenadas diretamente!',
  50,
  false
FROM agents
WHERE type = 'conversational_ai'
LIMIT 1;