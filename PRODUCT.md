# Product

## Register

product

## Users

Dois perfis, ambos em contexto de trabalho, olhando dados financeiros:

- **Parceiro** (somente leitura): franquia de hospitais que adquiriu o serviço da MedFlow. Acessa o portal para acompanhar suas próprias métricas, as solicitações de antecipação dos seus médicos, vencimentos e o total que tem a pagar à MedFlow. Nunca vê dados de outro parceiro. Quer respostas rápidas: "quanto devo, para quando, de quais médicos".
- **Gestor (MedFlow)**: equipe interna que acompanha a operação consolidada (todos os parceiros). Vê os mesmos dados de forma agregada e tem a única função de gerenciamento do portal: criar, visualizar e remover os logins dos parceiros.

Ambos são usuários adultos de ambiente corporativo/clínico. O foco é leitura e conferência, não operação.

## Product Purpose

Portal de **visualização** da operação de antecipação de recebíveis médicos da MedFlow. Não gerencia médicos, contratos nem a antecipação em si: apenas exibe informações já existentes na operação.

- Para o **parceiro**: dar transparência total sobre o que ele tem a pagar à MedFlow (o único compromisso financeiro: o valor antecipado aos seus médicos, sem taxa adicional), com vencimentos, solicitações dos médicos e métricas próprias.
- Para o **gestor**: visão consolidada de todos os parceiros + administração de acessos.

Sucesso = parceiro entende em segundos quanto deve e quando, sem ambiguidade; gestor enxerga o todo e controla acessos sem fricção.

## Brand Personality

Moderno e clean. Três palavras: **claro, confiável, leve**.

- Voz: direta e objetiva, em pt-br. Atendimento humanizado é parte da marca (vide site). Sem jargão financeiro desnecessário.
- Sensação alvo: produto contemporâneo no espírito da Vercel (preciso, tipográfico, bem espaçado) **sem a densidade** de um dashboard técnico. Combinar isso com a calma e a confiança de um produto de saúde (Oscar/Capsule): nada agressivo, números legíveis, respiro generoso.
- Confiança vem da clareza e da contenção, não de ornamento.
- **Continuidade de marca**: a MedFlow é uma fintech (regulada Bacen). O roxo `#53479B` e o título em Montserrat vêm do site institucional e devem persistir no portal, para o parceiro reconhecer que é a mesma empresa. A paleta exata vive em DESIGN.md.

## Anti-references

- **SaaS genérico de IA**: gradiente roxo, cards todos iguais com ícone+título+texto, eyebrow tracked em toda seção, hero-metric template. Fugir disso. (Atenção: o roxo é a cor da marca; usá-lo como cor sólida de marca é certo, mas como gradiente decorativo é o tell a evitar.)
- **Dashboard denso / "cockpit"**: muitos números espremidos, grids saturados, tudo competindo por atenção. A referência é Vercel/Linear pela limpeza, **não** pela densidade.
- **Institucional pesado / bancário antigo**: azul-marinho corporativo, sério a ponto de ficar frio e datado.
- **O próprio site institucional atual (Wix)**: Arial genérico, cantos de 3px, banners ilustrados, layout de template. O portal deve herdar a *marca* (roxo + Montserrat) mas ser visualmente mais limpo e moderno que o site de marketing, não copiá-lo.

## Design Principles

1. **Clareza do número acima de tudo.** O valor a pagar e o vencimento são a informação mais importante de qualquer tela do parceiro; hierarquia deve refletir isso.
2. **Leve, não denso.** Vibe Vercel: respiro, tipografia forte, poucos elementos por tela. Densidade é o inimigo aqui, não a sofisticação.
3. **Só leitura, e honesto sobre isso.** A interface não finge oferecer ações que não existem; nada de botões que sugerem gestão. Affordances refletem um portal de consulta.
4. **Isolamento de dados é parte do design.** O parceiro nunca deve sequer perceber a existência de outros parceiros. A visão do gestor é claramente "consolidada/todos" e visualmente distinta da do parceiro.
5. **Confiança pela contenção.** Cor e movimento usados com critério, a serviço da leitura dos dados financeiros, nunca decorativos.

## Accessibility & Inclusion

Sem exigência regulatória específica informada. Default sólido: contraste WCAG AA (corpo ≥ 4.5:1), navegação por teclado, foco visível e alternativa para `prefers-reduced-motion`. Números financeiros legíveis sem esforço (tamanho e contraste reforçados onde o valor for protagonista).
