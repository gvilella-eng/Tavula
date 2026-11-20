# Transcrever a sessão com o whisper.cpp

Este é o passo a passo para instalar o whisper.cpp no computador do mestre e transcrever uma gravação da chamada (CH3). O Távola **não baixa nada sozinho**: você instala o whisper.cpp e o modelo, e diz ao Távola onde eles estão.

O que está marcado com **(conferir na página)** eu não consegui afirmar sem entrar na internet: os nomes dos arquivos e os tamanhos mudam entre versões. Confira na página antes de baixar.

## O que você vai ter no fim

- `pnpm transcrever "<pasta da gravação>"` lê a gravação (os trechos de voz, um WAV por fala, na pasta da mesa), roda o whisper.cpp na placa de vídeo e escreve dentro da mesma pasta:
  - `transcricao.md`: a linha do tempo, com horário, nome e fala, misturada com o que a mesa registrou (chat, rolagens, troca de cena, combate);
  - `transcricao.json`: só as falas, uma linha por fala (`hora`, `pessoa`, `personagem`, `texto`).
- Na aba **Mesa**, seção **Gravações da sessão**, o botão **Trazer a transcrição** põe o texto numa nota só sua. Depois o Claude, pelo MCP, lê essa nota e escreve o resumo.

## 1. Baixar o whisper.cpp

1. Abra a página de releases do whisper.cpp: <https://github.com/ggml-org/whisper.cpp/releases> **(conferir na página: o projeto já mudou de dono uma vez)**.
2. Na lista de arquivos (Assets) da versão mais nova, procure os pacotes para Windows. Os nomes costumam ser parecidos com estes **(conferir na página)**:
   - `whisper-cublas-<versão cuda>-bin-x64.zip` (ou `whisper-bin-x64` com CUDA): o build **com CUDA**, para placas NVIDIA. Sua RTX 3050 de 6 GB usa este.
   - `whisper-bin-x64.zip`: o build só de **CPU**. Use este se o de CUDA não abrir (por exemplo, falta o driver) ou se você quiser testar sem a placa. É bem mais lento.
3. Escolha o CUDA que combina com o seu driver da NVIDIA **(conferir na página: o pacote diz a versão do CUDA)**. Se o driver for recente, o CUDA 12 serve; o pacote traz as DLLs do CUDA que ele precisa, então normalmente não há o que instalar além do driver da placa.
4. Descompacte numa pasta sua, sem espaço no caminho de preferência, por exemplo `C:\whisper\`.
5. Dentro da pasta deve haver o programa de linha de comando. Nas versões mais novas ele se chama `whisper-cli.exe`; nas antigas era `main.exe` **(conferir na página)**. O Távola pede o `whisper-cli.exe`.

## 2. Baixar o modelo

O modelo é um arquivo `.bin` (formato ggml). Os modelos ficam na página do whisper.cpp no Hugging Face: <https://huggingface.co/ggerganov/whisper.cpp> **(conferir na página)**.

Recomendação para a RTX 3050 de 6 GB e português: **`large-v3-turbo`**.

| Modelo | Arquivo (conferir na página) | Tamanho aproximado (conferir na página) | Diferença |
|---|---|---|---|
| `large-v3-turbo` | `ggml-large-v3-turbo.bin` | cerca de 1,6 GB | A versão "turbo" do large-v3: a mesma qualidade para a maioria dos casos, bem mais rápida (decodificador menor). O melhor ponto para uma placa de 6 GB. |
| `large-v3-turbo` quantizado | `ggml-large-v3-turbo-q5_0.bin` (ou `q8_0`) | cerca de 0,6 GB (`q5_0`) | Menor e mais leve na memória da placa, com uma perda pequena de qualidade. Use se a placa ficar sem memória ou se o computador estiver ocupado com a mesa e a chamada. |
| `large-v3` | `ggml-large-v3.bin` | cerca de 3 GB | A melhor qualidade, mas mais lento; com 6 GB de placa, aperta. Só se a diferença no texto importar. |
| `medium` | `ggml-medium.bin` | cerca de 1,5 GB | Mais rápido que o large, com erros a mais em nomes e em frases curtas. Reserva. |

(Os tamanhos são de cabeça, do que se sabe do projeto: confira a lista na página antes de baixar.)

Ponha o arquivo na mesma pasta, por exemplo `C:\whisper\ggml-large-v3-turbo.bin`.

## 3. Dizer ao Távola onde estão

De um destes dois jeitos (a variável de ambiente vale mais que o arquivo):

**a) Variáveis de ambiente** (Windows: Configurações, Variáveis de ambiente; ou, só para a janela do terminal aberta):

```powershell
$env:WHISPER_EXE = "C:\whisper\whisper-cli.exe"
$env:WHISPER_MODELO = "C:\whisper\ggml-large-v3-turbo.bin"
```

**b) Um arquivo `transcrever.config.json` na raiz do repositório** (ele está no `.gitignore`: cada computador tem o seu):

```json
{
  "whisperExe": "C:\\whisper\\whisper-cli.exe",
  "modelo": "C:\\whisper\\ggml-large-v3-turbo.bin"
}
```

Opções que existem, se precisar: `WHISPER_IDIOMA` ou `"idioma"` (padrão `pt`); `WHISPER_SEM_GPU=1` ou `"semGpu": true` (roda na CPU, passando `-ng`).

Se faltar algo, o `pnpm transcrever` diz o que falta e onde pôr.

## 4. Conferir

1. Numa janela do terminal, rode o programa sozinho:
   ```powershell
   C:\whisper\whisper-cli.exe -h
   ```
   Deve listar as opções (`-m`, `-f`, `-l`, `-oj`, `-of`, `--prompt`, `-pp`, `-ng`) **(conferir na página: o texto de ajuda da sua versão é a fonte)**.
2. Veja se a placa foi usada. Ao rodar com um áudio, o início da saída diz algo como `ggml_cuda_init: found 1 CUDA devices` **(conferir na página)**. Se disser que não achou, o pacote de CUDA não casa com o driver: troque de pacote ou use o de CPU.
3. Faça uma gravação curta de teste na chamada (o botão **Gravar para transcrição**, só o mestre) e rode:
   ```powershell
   pnpm transcrever "C:\caminho\da\pasta-da-mesa\gravacoes\2026-11-20_21h14"
   ```
   O terminal mostra a pessoa, o trecho em andamento e o tempo que falta. No fim, abra `transcricao.md`.

## Como o Távola chama o whisper

Para cada pessoa o script junta os trechos num WAV só, com 1 s de silêncio entre eles (o whisper gasta o mesmo tempo num trecho de 2 s e num de 30 s, então um arquivo só é bem mais rápido que um por trecho), e roda:

```
whisper-cli -m <modelo> -f <wav emendado> -l pt -oj -of <saída> -pp --prompt "Nomes: ..."
```

O programa é chamado **sem shell**, com os argumentos numa lista. O `--prompt` leva os nomes dos personagens, NPCs e cenas da mesa (`nomes.txt`), que ajudam o whisper a acertar os nomes. Os horários do JSON voltam à hora da sessão pelo mapa de deslocamentos.

## Se der errado

- **"O whisper terminou com erro"** numa pessoa: o script segue com as outras e diz no fim. O texto da falha é o fim da saída do whisper. Rode de novo depois de corrigir; o resultado é refeito.
- **Faltou memória da placa**: troque para o modelo quantizado, ou rode com `WHISPER_SEM_GPU=1`.
- **O texto sai em outro idioma ou inventa frases nos silêncios**: é um defeito conhecido dos modelos whisper em áudio quase mudo. O Távola só manda os trechos com fala, o que reduz isso. Se acontecer, apague a linha.
- **Nenhuma fala**: confira se a pessoa não marcou "Não gravar a minha voz" e se o microfone estava ligado.
