# Requirements Document

## Introduction

Sistema de gerenciamento de entregadores de delivery que permite o controle de escalas de motoqueiros em diferentes estabelecimentos parceiros. O sistema possui dois perfis de acesso: motoqueiro e administrador. O motoqueiro visualiza sua escala de trabalho e acompanha seu desempenho financeiro e operacional. O administrador gerencia entregadores, estabelecimentos e escalas.

## Glossary

- **Sistema**: O sistema de gerenciamento de entregadores de delivery como um todo.
- **Motoqueiro**: Entregador cadastrado no sistema que realiza corridas de delivery.
- **Administrador**: Usuário com permissão total de gestão sobre motoqueiros, estabelecimentos e escalas.
- **Estabelecimento**: Local parceiro (restaurante, lanchonete, mercado, etc.) onde o motoqueiro pode ser escalado.
- **Escala**: Registro que associa um motoqueiro a um estabelecimento em uma data e turno específicos.
- **Corrida**: Entrega realizada por um motoqueiro a partir de um estabelecimento.
- **Dashboard**: Painel de visualização de indicadores de desempenho do motoqueiro.
- **Faturamento**: Valor total recebido pelo motoqueiro por suas corridas em um período.
- **Turno**: Período de trabalho definido dentro de um dia (ex.: manhã, tarde, noite).

---

## Requirements

### Requirement 1: Autenticação de Usuários

**User Story:** Como usuário do sistema, quero fazer login com minhas credenciais, para que eu possa acessar as funcionalidades do meu perfil com segurança.

#### Critérios de Aceitação

1. THE Sistema SHALL exigir e-mail e senha para autenticação de todos os usuários.
2. WHEN um usuário fornece credenciais válidas, THE Sistema SHALL autenticá-lo e redirecioná-lo para a tela inicial do seu perfil (motoqueiro ou administrador).
3. IF um usuário fornece credenciais inválidas, THEN THE Sistema SHALL exibir uma mensagem de erro genérica e bloquear o acesso.
4. WHEN um usuário realiza 5 tentativas de login malsucedidas consecutivas, THE Sistema SHALL bloquear o acesso da conta por 15 minutos e exibir uma mensagem informando o tempo de bloqueio.
5. WHEN um usuário autenticado permanece inativo por 30 minutos, THE Sistema SHALL encerrar a sessão automaticamente e redirecionar para a tela de login.
6. THE Sistema SHALL manter a sessão do usuário autenticado entre navegações dentro da aplicação.

---

### Requirement 2: Gerenciamento de Motoqueiros (Administrador)

**User Story:** Como administrador, quero cadastrar, editar e desativar motoqueiros, para que eu possa manter a base de entregadores atualizada.

#### Critérios de Aceitação

1. THE Sistema SHALL permitir que o Administrador cadastre um novo motoqueiro informando: nome completo, CPF, telefone, e-mail e senha inicial.
2. WHEN o Administrador submete o formulário de cadastro de motoqueiro, THE Sistema SHALL validar que o CPF e o e-mail são únicos no sistema.
3. IF o CPF ou e-mail já estiver cadastrado, THEN THE Sistema SHALL exibir uma mensagem de erro identificando o campo duplicado.
4. THE Sistema SHALL permitir que o Administrador edite os dados cadastrais de qualquer motoqueiro.
5. THE Sistema SHALL permitir que o Administrador desative um motoqueiro, impedindo que o usuário faça login e seja escalado em novas escalas.
6. WHEN um motoqueiro é desativado, THE Sistema SHALL preservar todo o histórico de corridas e faturamento do motoqueiro.
7. THE Sistema SHALL exibir uma lista paginada de motoqueiros com filtros por nome, status (ativo/inativo) e estabelecimento associado.

---

### Requirement 3: Gerenciamento de Estabelecimentos (Administrador)

**User Story:** Como administrador, quero cadastrar e gerenciar os estabelecimentos parceiros, para que eu possa associá-los às escalas dos motoqueiros.

#### Critérios de Aceitação

1. THE Sistema SHALL permitir que o Administrador cadastre um estabelecimento informando: nome, endereço completo (logradouro, número, complemento, bairro, cidade, estado e CEP) e telefone de contato.
2. WHEN o Administrador submete o formulário de cadastro de estabelecimento, THE Sistema SHALL validar que o nome do estabelecimento é único no sistema.
3. THE Sistema SHALL permitir que o Administrador edite os dados de qualquer estabelecimento.
4. THE Sistema SHALL permitir que o Administrador desative um estabelecimento, impedindo que ele seja utilizado em novas escalas.
5. WHEN um estabelecimento é desativado, THE Sistema SHALL preservar o histórico de escalas e corridas vinculadas a ele.
6. THE Sistema SHALL exibir uma lista paginada de estabelecimentos com filtros por nome e status (ativo/inativo).

---

### Requirement 4: Gerenciamento de Escalas (Administrador)

**User Story:** Como administrador, quero criar e gerenciar a escala de motoqueiros nos estabelecimentos, para que eu possa organizar a distribuição de entregadores de forma eficiente.

#### Critérios de Aceitação

1. THE Sistema SHALL permitir que o Administrador crie uma escala associando um ou mais motoqueiros ativos a um estabelecimento ativo em uma data e turno específicos.
2. WHEN o Administrador tenta escalar um motoqueiro que já possui escala no mesmo dia e turno, THE Sistema SHALL exibir um aviso de conflito antes de confirmar o cadastro.
3. THE Sistema SHALL permitir que o Administrador edite ou cancele uma escala futura.
4. WHEN uma escala é cancelada, THE Sistema SHALL notificar o motoqueiro afetado por meio de notificação no aplicativo.
5. THE Sistema SHALL exibir uma visão de calendário semanal com as escalas de todos os motoqueiros por estabelecimento.
6. THE Sistema SHALL permitir que o Administrador filtre a visão de escalas por motoqueiro, estabelecimento, data e turno.
7. WHEN uma escala é criada ou alterada, THE Sistema SHALL registrar a data, hora e identidade do Administrador responsável pela ação.

---

### Requirement 5: Visualização de Escala pelo Motoqueiro

**User Story:** Como motoqueiro, quero visualizar minha escala de trabalho, para que eu possa me planejar e chegar aos estabelecimentos no horário correto.

#### Critérios de Aceitação

1. WHEN o Motoqueiro acessa a tela de escala, THE Sistema SHALL exibir todas as escalas futuras do motoqueiro ordenadas cronologicamente, incluindo: data, turno, nome do estabelecimento e endereço completo do estabelecimento.
2. THE Sistema SHALL destacar visualmente a escala do dia corrente na listagem.
3. WHEN o Motoqueiro toca no botão de navegação de uma escala, THE Sistema SHALL abrir o aplicativo de GPS padrão do dispositivo com o endereço do estabelecimento preenchido como destino.
4. THE Sistema SHALL exibir escalas dos próximos 30 dias na tela de escala do Motoqueiro.
5. WHEN não há escalas futuras cadastradas para o motoqueiro, THE Sistema SHALL exibir uma mensagem informando a ausência de escalas.

---

### Requirement 6: Dashboard de Desempenho do Motoqueiro

**User Story:** Como motoqueiro, quero visualizar meu desempenho financeiro e operacional em um painel, para que eu possa acompanhar meus ganhos e produtividade.

#### Critérios de Aceitação

1. WHEN o Motoqueiro acessa o Dashboard, THE Sistema SHALL exibir o faturamento do dia corrente, o faturamento da semana corrente e o faturamento do mês corrente.
2. WHEN o Motoqueiro acessa o Dashboard, THE Sistema SHALL exibir a quantidade de corridas realizadas no dia corrente.
3. THE Sistema SHALL calcular o faturamento diário como a soma dos valores de todas as corridas finalizadas no dia corrente pelo motoqueiro.
4. THE Sistema SHALL calcular o faturamento semanal como a soma dos valores de todas as corridas finalizadas de segunda-feira a domingo da semana corrente pelo motoqueiro.
5. THE Sistema SHALL calcular o faturamento mensal como a soma dos valores de todas as corridas finalizadas no mês corrente pelo motoqueiro.
6. WHEN não há corridas registradas no período, THE Sistema SHALL exibir o valor zero para os indicadores correspondentes.
7. THE Sistema SHALL atualizar os indicadores do Dashboard em tempo real sempre que uma nova corrida for registrada para o motoqueiro.

---

### Requirement 7: Registro de Corridas

**User Story:** Como administrador, quero registrar as corridas realizadas pelos motoqueiros, para que o faturamento e as métricas de desempenho sejam calculados corretamente.

#### Critérios de Aceitação

1. THE Sistema SHALL permitir que o Administrador registre uma corrida informando: motoqueiro, estabelecimento, data e hora, e valor da corrida.
2. WHEN uma corrida é registrada, THE Sistema SHALL associá-la automaticamente à escala ativa do motoqueiro no estabelecimento na data e turno correspondentes, se existir.
3. IF o valor da corrida informado for menor ou igual a zero, THEN THE Sistema SHALL rejeitar o registro e exibir uma mensagem de validação.
4. THE Sistema SHALL permitir que o Administrador edite ou cancele uma corrida registrada no mesmo dia de seu lançamento.
5. WHEN uma corrida é cancelada, THE Sistema SHALL deduzir o valor correspondente do faturamento do motoqueiro.
6. THE Sistema SHALL exibir o histórico de corridas de um motoqueiro com filtros por data, estabelecimento e status (ativa/cancelada).

---

### Requirement 8: Notificações para o Motoqueiro

**User Story:** Como motoqueiro, quero receber notificações sobre alterações na minha escala, para que eu seja informado de mudanças sem precisar verificar o sistema manualmente.

#### Critérios de Aceitação

1. WHEN uma escala do motoqueiro é criada, THE Sistema SHALL enviar uma notificação no aplicativo informando a data, turno e estabelecimento da nova escala.
2. WHEN uma escala do motoqueiro é alterada, THE Sistema SHALL enviar uma notificação no aplicativo informando os dados anteriores e os dados atualizados da escala.
3. WHEN uma escala do motoqueiro é cancelada, THE Sistema SHALL enviar uma notificação no aplicativo informando a data, turno e estabelecimento da escala cancelada.
4. THE Sistema SHALL exibir um histórico de notificações recebidas pelo motoqueiro, ordenado da mais recente para a mais antiga.
5. WHEN o motoqueiro visualiza uma notificação, THE Sistema SHALL marcá-la como lida e remover o indicador de notificação não lida.

---

### Requirement 9: Relatórios Gerenciais (Administrador)

**User Story:** Como administrador, quero visualizar relatórios consolidados de desempenho, para que eu possa tomar decisões gerenciais baseadas em dados.

#### Critérios de Aceitação

1. THE Sistema SHALL disponibilizar ao Administrador um relatório de faturamento por motoqueiro com filtro por período (diário, semanal, mensal e intervalo personalizado).
2. THE Sistema SHALL disponibilizar ao Administrador um relatório de quantidade de corridas por motoqueiro com filtro por período.
3. THE Sistema SHALL disponibilizar ao Administrador um relatório de escalas por estabelecimento com filtro por período.
4. WHEN o Administrador solicita a exportação de um relatório, THE Sistema SHALL gerar e disponibilizar o arquivo no formato CSV.
5. THE Sistema SHALL exibir os relatórios em formato de tabela com opção de ordenação por qualquer coluna.

---

### Requirement 10: Segurança e Controle de Acesso

**User Story:** Como administrador, quero garantir que cada perfil de usuário acesse apenas as funcionalidades permitidas, para que os dados do sistema estejam protegidos contra acessos indevidos.

#### Critérios de Aceitação

1. THE Sistema SHALL restringir o acesso às funcionalidades de gerenciamento (motoqueiros, estabelecimentos, escalas, corridas e relatórios) exclusivamente ao perfil Administrador.
2. THE Sistema SHALL restringir o acesso às telas de escala e dashboard exclusivamente ao perfil Motoqueiro.
3. IF um usuário tentar acessar uma rota não permitida para o seu perfil, THEN THE Sistema SHALL redirecionar o usuário para a tela inicial do seu perfil e exibir uma mensagem de acesso negado.
4. THE Sistema SHALL transmitir todos os dados entre cliente e servidor utilizando protocolo HTTPS.
5. THE Sistema SHALL armazenar senhas utilizando algoritmo de hash seguro com salt individual por usuário.
6. WHEN um Administrador altera a senha de um motoqueiro, THE Sistema SHALL exigir que o motoqueiro redefina a senha no próximo login.
```
