import { FastifyInstance } from "fastify";
import { createReadStream } from "node:fs";
import { prisma } from "../lib/prisma"
import { z } from "zod"
import { openai } from "../lib/openai"

export const createTranscriptionRoute = async (app: FastifyInstance) => {
  app.post('/videos/:videoId/transcription', async (req, res) => {
    // Verifica se o parâmetro da url seque o padrão esperado.
    const paramsSchema = z.object({
      videoId: z.string().uuid()
    })

    // Captura o videoId verificado com o paramsSchema.
    const { videoId } = paramsSchema.parse(req.params)

    // Verifica o body da aplicação
    const bodySchema = z.object({
      prompt: z.string()
    })

    // Captura o prompt do body da aplicação verificado
    const { prompt } = bodySchema.parse(req.body)

    // Encontra o video ou dispara um erro
    const video = await prisma.video.findFirstOrThrow({
      where: {
        id: videoId
      }
    })

    // Captura o caminho do arquivo de audio
    const videoPath = video.path

    // Lê em stream o arquivo no caminho passado
    const audioReadStream = createReadStream(videoPath)

    const response = await openai.audio.transcriptions.create({
      file: audioReadStream,
      model: "whisper-1",
      language: "pt",
      response_format: "json",
      temperature: 0,
      prompt
    })

    const transcription = response.text

    await prisma.video.update({
      where: {
        id: video.id
      },
      data: {
        transcription
      }
    })

    return transcription
  })
}