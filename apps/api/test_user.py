import bcrypt

# Hash do banco de dados
hash_from_db = '$2b$12$4rlZ73QcfEhxZDZayq.oeOVGX0Uamj/QyFXpxi5eNNNYhEqaU.0Z6'

# Senhas para testar
senhas = [
    'Admin123!',
    'admin',
    'admin123',
    'Admin123',
]

print("Testando senhas contra o hash do banco:")
print("=" * 60)

for senha in senhas:
    resultado = bcrypt.checkpw(senha.encode('utf-8'), hash_from_db.encode('utf-8'))
    status = 'CORRETA' if resultado else 'Incorreta'
    print(f"Senha '{senha}': {status}")

print("\n" + "=" * 60)
print("Gerando novo hash para 'Admin123!':")
novo_hash = bcrypt.hashpw('Admin123!'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
print(f"Novo hash: {novo_hash}")

# Testar o novo hash
print("\nTestando novo hash:")
resultado = bcrypt.checkpw('Admin123!'.encode('utf-8'), novo_hash.encode('utf-8'))
status = 'CORRETA' if resultado else 'Incorreta'
print(f"Senha 'Admin123!' com novo hash: {status}")
