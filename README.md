# Lotofácil Lab

Gerador de jogos por orçamento, fechamentos com garantia conferida, estatísticas, teste de estratégias no histórico e conferência para **Lotofácil, Mega-Sena, +Milionária e Timemania**.

- Abre em qualquer navegador e pode ser instalado no celular ("Adicionar à tela inicial").
- `data/*.txt` guarda o histórico de resultados; o robô em `.github/workflows/atualizar-resultados.yml` busca os sorteios novos toda noite e atualiza esses arquivos.
- Jogos salvos e a chave da API do agente ficam só no navegador de cada aparelho. Nada pessoal é guardado neste repositório.

Loteria é jogo de azar: nenhum filtro, histórico ou agente aumenta a chance de acertar. Jogue só o que pode perder.

## Robô da Caixa

Na aba **Dados** do app há o favorito "Robô Lotofácil Lab". Instalado na barra de favoritos de um navegador de computador, ele monta o carrinho no Loterias Online a partir da lista de jogos copiada do app. Ele só marca números e coloca no carrinho; a conferência e o pagamento são sempre do usuário. O código fica em `robo.js`.
