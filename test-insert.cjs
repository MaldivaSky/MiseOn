const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/"/g, '');
  return acc;
}, {});

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testInsert() {
  console.log('Testing chat_conversations insert...');
  
  const { data: lojas, error: lojaError } = await supabase.from('lojas').select('id').limit(1);
  if (lojaError || !lojas || lojas.length === 0) {
    console.error('Error fetching loja:', lojaError);
    return;
  }
  
  const lojaId = lojas[0].id;
  console.log('Using Loja ID:', lojaId);
  
  const { data, error } = await supabase.from('chat_conversations').insert({
    loja_id: lojaId,
    session_id: 'test_session_123'
  }).select().single();
  
  if (error) {
    console.error('INSERT FAILED!', error);
  } else {
    console.log('INSERT SUCCESS:', data);
    
    console.log('Testing chat_messages insert...');
    const { data: msgData, error: msgError } = await supabase.from('chat_messages').insert({
      conversation_id: data.id,
      remetente_tipo: 'CLIENTE',
      conteudo: 'Teste de mensagem'
    }).select().single();
    
    if (msgError) {
      console.error('MSG INSERT FAILED!', msgError);
    } else {
      console.log('MSG INSERT SUCCESS:', msgData);
    }
  }
}

testInsert();
