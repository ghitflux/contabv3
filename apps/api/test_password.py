from passlib.context import CryptContext

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

# Hash completo do banco de dados
hash_from_db = '$2b$12$4rlZ73QcfEhxZDZayq.oeOVGX0Uamj/QyaUIqBAoqNCDe/RtmSjry'

# Testar várias senhas possíveis
senhas_para_testar = [
    'admin',
    'admin123',
    'Admin123',
    'contabil',
    'contabil123',
    '123456',
    'password'
]

print("Testando senhas contra o hash do banco de dados:")
print("=" * 60)

for senha in senhas_para_testar:
    resultado = pwd_context.verify(senha, hash_from_db)
    print(f"Senha '{senha}': {'✓ CORRETA' if resultado else '✗ Incorreta'}")
