export const maskCPF = (v: string) => {
  v = v.replace(/\D/g, '');
  if (v.length <= 11) {
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return v;
};

export const maskCNPJ = (v: string) => {
  v = v.replace(/\D/g, '');
  v = v.replace(/^(\d{2})(\d)/, '$1.$2');
  v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
  v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
  v = v.replace(/(\d{4})(\d)/, '$1-$2');
  return v.substring(0, 18);
};

export const maskCPFouCNPJ = (v: string) => {
  const digits = v.replace(/\D/g, '');
  if (digits.length <= 11) return maskCPF(digits);
  return maskCNPJ(digits);
};

export const validarCPF = (cpf: string) => {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf === '' || cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  let soma = 0;
  let resto;
  for (let i = 1; i <= 9; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if ((resto === 10) || (resto === 11)) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if ((resto === 10) || (resto === 11)) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;

  return true;
};

export const validarCNPJ = (cnpj: string) => {
  cnpj = cnpj.replace(/[^\d]+/g, '');
  if (cnpj === '') return false;
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  const digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado !== parseInt(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado !== parseInt(digitos.charAt(1))) return false;

  return true;
};

export const validarCPFouCNPJ = (doc: string) => {
  const digitos = doc.replace(/\D/g, '');
  if (digitos.length <= 11) return validarCPF(digitos);
  return validarCNPJ(digitos);
};

export const maskTelefone = (v: string) => {
  v = v.replace(/\D/g, '');
  v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
  v = v.replace(/(\d)(\d{4})$/, '$1-$2');
  return v.substring(0, 15);
};

export const maskCEP = (v: string) => {
  v = v.replace(/\D/g, '');
  v = v.replace(/^(\d{5})(\d)/, '$1-$2');
  return v.substring(0, 9);
};

export const maskCartaoCredito = (v: string) => {
  v = v.replace(/\D/g, '');
  v = v.replace(/(\d{4})(\d)/, '$1 $2');
  v = v.replace(/(\d{4}) (\d{4})(\d)/, '$1 $2 $3');
  v = v.replace(/(\d{4}) (\d{4}) (\d{4})(\d)/, '$1 $2 $3 $4');
  return v.substring(0, 19);
};

export const maskValidadeCartao = (v: string) => {
  v = v.replace(/\D/g, '');
  v = v.replace(/(\d{2})(\d)/, '$1/$2');
  return v.substring(0, 5);
};
