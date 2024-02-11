import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { validarCaptura } from "../services/solicitud.services";
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const helloWorld = (req: Request, res: Response) => {
    res.json({ message: "Hello world" });
};

//Admin
export async function getAdmins(req: Request, res: Response) {
    const admins = await prisma.admin.findMany()
    return res.json(admins)
};

//Solicitudes
export async function createRequest(req: Request, res: Response) {
    try {
        const requestData = req.body
        const captura = req.file;

        const requiredFields = ['expediente_alumno', 'nombre_alumno', 'ap_paterno', 'ap_materno', 'email_alumno', 'clave_materia'];

        for (const field of requiredFields) {
            if (!(field in requestData) || requestData[field] === null || requestData[field] === undefined) {
                return res.status(400).json({ error: `El campo '${field}' es obligatorio` });
            }
        }

        //Parsear datos al tipo correcto.
        requestData.expediente_alumno = parseInt(requestData.expediente_alumno)
        requestData.clave_materia = parseInt(requestData.clave_materia)

        if (!captura) {
            return res.status(400).json({ code: "NO_FILE", message: "No se ha enviado ninguna captura de pantalla." });
        }

        const capturaValida = await validarCaptura(captura.buffer, req.body.expediente_alumno);


        if (!req.body.expediente_alumno) {
            return res.status(400).json({ code: "INCOMPLETE_DATA", message: "Faltan los siguientes datos: Expediente." });
        }

        if (!capturaValida) {
            return res.status(400).json({ code: "INVALID_FILE", message: "La captura de pantalla es inválida." });
        }

        // Find or create group
        const existingGroup = await prisma.grupo.findFirst({
            where: {
                clave_materia: requestData.clave_materia,
                Periodo: {
                    activo: true,
                },
            },
        });

        let groupId;
        if (existingGroup) {
            groupId = existingGroup.id_grupo;
        } else {
            const currentPeriod = await prisma.periodo.findFirst({
                where: {
                    activo: true,
                },
            });

            if (!currentPeriod) {
                return res.status(400).json({ message: 'No hay un periodo activo', code: "NO_ACTIVE_PERIOD" });
            }

            const newGroup = await prisma.grupo.create({
                data: {
                    clave_materia: requestData.clave_materia,
                    Periodo: {
                        connect: {
                            id_periodo: currentPeriod.id_periodo,
                        },
                    },
                },
            });
            groupId = newGroup.id_grupo;
        }

        // Check if the student is already registered in the group
        const existingRequest = await prisma.solicitud.findFirst({
            where: {
                expediente_alumno: requestData.expediente_alumno,
                id_grupo: groupId,
            },
        });

        if (existingRequest) {
            return res.status(400).json({ message: 'El alumno ya está inscrito en este grupo', code: "ALREADY_REGISTERED" });
        }

        // Create the request
        const newRequest = await prisma.solicitud.create({
            data: {
                expediente_alumno: requestData.expediente_alumno,
                nombre_alumno: requestData.nombre_alumno,
                ap_paterno: requestData.ap_paterno,
                ap_materno: requestData.ap_materno,
                email_alumno: requestData.email_alumno,
                id_grupo: groupId,
            },
        });

        // Increment the group's inscritos count
        await prisma.grupo.update({
            where: {
                id_grupo: groupId,
            },
            data: {
                inscritos: {
                    increment: 1,
                },
            },
        });

        return res.status(201).json({ message: 'Solicitud creada correctamente', data: { id: newRequest.id_solicitud }, code: "OK" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al crear la solicitud', code: "INTERNAL_ERROR" });
    }
}

//Feed Grupos
export async function getGroups(req: Request, res: Response) {
    try {
        const groups = await prisma.grupo.findMany({
            where: {
                OR: [
                    {
                        admin_created: {
                            equals: true
                        },
                    },
                    {
                        inscritos: {
                            gte: 3,
                        },
                    },
                ],
            },
            include: {
                materia: {
                    include: {
                        area: true,
                        Carreras: true,
                    },
                },
            },
        });

        const formattedGroups = groups.map((group) => ({
            clave_materia: group.materia?.clave,
            nombre_materia: group.materia?.nombre,
            area: group.materia?.area?.nombre,
            area_img: group.materia?.area?.url,
            inscritos: group.inscritos,
            // format dates as HH:MM - HH:MM
            // horario: group.hora_inicio && group.hora_fin ? `${group.hora_inicio.toUTCString().slice(17, 22)} - ${group.hora_fin.toUTCString().slice(17, 22)}` : "No definido",
            horario: group.hora_inicio && group.hora_fin ? `${group.hora_inicio} - ${group.hora_fin}` : "No definido",
            carreras: group.materia?.Carreras.map((carrera) => carrera.abreviatura),
            profesor: group.profesor || "No definido",
            costo: group.costo || "No definido",
        }));

        return res.status(200).json(formattedGroups);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al obtener los grupos' });
    }
}