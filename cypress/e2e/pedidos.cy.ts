import { mockSupabase } from '../support/mockDB';

describe('Fluxo de Pedidos', () => {
  beforeEach(() => {
    mockSupabase();
  });

  it('deve criar um pedido completo com Pix', () => {
    cy.visit('/teste');
    cy.wait('@getLojas');

    // Clica no produto
    cy.contains('X-Burger').click();
    
    // Confirma modal de produto
    cy.contains('Adicionar').click();

    // Carrinho deve atualizar
    cy.contains('1 item(ns)').should('be.visible');
    
    // Abre checkout
    cy.contains('Finalizar pedido').click();

    // Como não estamos logados, deve pedir pra entrar
    cy.contains('Entrar com Google').should('be.visible');
    
    // Fecha modal e faz login via mock
    cy.get('.fade').click('topRight');
    cy.mockAuth();
    cy.visit('/teste'); // reload pra pegar auth
    
    // Refaz processo com auth
    cy.contains('X-Burger').click();
    cy.contains('Adicionar').click();
    cy.contains('Finalizar pedido').click();

    // Seleciona Pix
    cy.contains('Pagar com Pix').click();
    
    // Mock do polling de pagamento
    cy.intercept('GET', '**/rest/v1/pagamentos*', {
      statusCode: 200,
      body: [{ id: 'pag-1', status: 'PAGO' }]
    }).as('checkPagamento');

    cy.contains('Confirmar pedido').click();

    // Deve bater na function de pix
    cy.wait('@pixCreate');

    // Como o pagamento já volta PAGO no polling, deve ir direto para a tela de sucesso
    cy.contains('Pagamento confirmado!').should('be.visible');
  });

  it('deve utilizar cashback no pedido', () => {
    cy.mockAuth();
    cy.visit('/teste');

    cy.contains('X-Burger').click();
    cy.contains('Adicionar').click();
    cy.contains('Finalizar pedido').click();

    // Aguarda o cliente ser carregado para exibir cashback
    cy.wait('@getClientes');

    // Deve ter a opção de usar cashback
    cy.contains('Usar R$ 10,00 de cashback').click();

    // O total era 15, com 10 de desconto deve virar 5
    // Vamos procurar pelo valor formatado
    cy.contains('R$ 5,00').should('be.visible');
  });

  it('deve cancelar pedido no status NOVO com estorno', () => {
    // Mock admin role para acessar /admin/pedidos
    cy.mockAuth('admin-user-id');
    
    cy.intercept('GET', '**/rest/v1/pedidos*', {
      statusCode: 200,
      body: [{ 
        id: 'pedido-1', 
        numero: 1002, 
        status: 'NOVO', 
        total: 15,
        cliente_id: 'client-1',
        pedido_itens: [] 
      }]
    }).as('getAdminPedidos');

    cy.intercept('PATCH', '**/rest/v1/pedidos*', { statusCode: 200 }).as('patchPedido');
    cy.intercept('PATCH', '**/rest/v1/pagamentos*', { statusCode: 200 });

    // Rota admin fictícia configurada no mock DB ou carregando componente
    cy.visit('/admin/pedidos');
    cy.wait('@getAdminPedidos');

    cy.contains('#1002').click();
    cy.contains('Cancelar Pedido').click();
    
    // Confirmação (se houver modal de JS confirm, Cypress aprova por padrão)
    // Se houver um botão de modal, simulamos o clique:
    cy.get('button').contains('Sim, cancelar').click();

    // O patch para CANCELADO deve ter sido enviado
    cy.wait('@patchPedido').its('request.body').should('include', { status: 'CANCELADO' });
  });
});
