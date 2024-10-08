import { Request, Response } from "express";
import { PrismaClient, grupo } from "@prisma/client";
import jwt from 'jsonwebtoken';

import bcrypt from 'bcrypt';
import { JWT_SECRET } from "../configs/configs";
import { Decimal } from "@prisma/client/runtime/library";
const prisma = new PrismaClient();

export const adminLogin = async (req: Request, res: Response) => {

    //POR SI HAY QUE ACTUALIZAR ALGUN CAMPO EN LA BASE DE DATOS
    // const newPassword = bcrypt.hashSync(req.body.password, 10);
    // await prisma.admin.updateMany({
    //     where: {
    //         username: req.body.username
    //     },
    //     data: {
    //         password: newPassword
    //     }
    // })
    // return res.send("todo bien");

    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Faltan datos.' });
        }

        const admin = await prisma.admin.findFirst({
            where: {
                username: username,
            },
        });

        if (!admin) {
            // get all admins, if no admin add it with its password
            const allAdmins = await prisma.admin.findMany();

            if (allAdmins.length > 0) {
                return res.status(404).json({ message: "Admin no encontrado." });
            }

            const newPassword = bcrypt.hashSync(password, 10);

            const newAdmin = await prisma.admin.create({
                data: {
                    username: username,
                    password: newPassword
                }
            });

            const token = jwt.sign({ id: newAdmin.id_admin }, JWT_SECRET);

            return res.json({
                code: "OK",
                message: "Login correcto.",
                data: token
            });
        }

        const isValidPass = bcrypt.compareSync(password, admin.password!);

        if (!isValidPass) {
            return res.status(400).json({ message: "Contraseña no valida." });
        }

        const token = jwt.sign({ id: admin.id_admin }, JWT_SECRET);

        return res.json({
            code: "OK",
            message: "Login correcto.",
            data: token
        });

    } catch (error) {
        return res.status(500).json({ message: "Algo salió mal." });
    }
}

async function createGroup(groupData: Omit<grupo, 'id_grupo'>, claveMateria: number) {
    try {
        const existingMateria = await prisma.materia.findUnique({
            where: { clave: claveMateria },
        });

        if (!existingMateria) {
            return { error: 'La materia especificada no existe' };
        }

        const newGroup = await prisma.grupo.create({
            data: {
                ...groupData,
                admin_created: true,
                clave_materia: claveMateria,
            },
        });

        return { group: newGroup };
    } catch (error) {
        console.error('Error al crear el grupo:', error);
        throw error;
    }
}

export async function updateGroup(req: Request, res: Response) {
    try {
        const groupId = parseInt(req.params.id);
        const updatedData = req.body;

        const updatedGroup = await prisma.grupo.update({
            where: { id_grupo: groupId },
            data: {
                admin_created: true,
                costo: updatedData.costo,
                profesor: updatedData.profesor,
                hora_inicio: updatedData.hora_inicio,
                hora_fin: updatedData.hora_fin,
            },
        });

        return res.status(200).json({ message: 'Grupo actualizado correctamente', data: updatedGroup, code: "OK" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al actualizar el grupo' });
    }
}

export async function groupInfo(req: Request, res: Response) {
    try {
        const groupId = parseInt(req.params.id);
        const group = await prisma.grupo.findUnique({
            where: { id_grupo: groupId },
            include: {
                materia: {
                    select: {
                        nombre: true,
                    }
                }
            }
        });

        if (!group) {
            return res.status(404).json({ message: 'Grupo no encontrado.' });
        }

        return res.status(200).json({ message: 'Grupo encontrado.', data: group, code: "OK" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al obtener la información de grupo' })
    }
}

export async function getRequests(req: Request, res: Response) {
    try {
        const groupId = parseInt(req.params.id);

        const existingRequests = await prisma.solicitud.findMany({
            where: { id_grupo: groupId },
            select: {
                nombre_alumno: true,
                ap_paterno: true,
                expediente_alumno: true,
                email_alumno: true,
                telefono_alumno: true,
            }
        });

        return res.status(200).json({ message: 'Solicitudes encontradas', data: existingRequests, code: "OK" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al obtener las solicitudes' })
    }
}

export async function getMateria(req: Request, res: Response) {
    try {
        const materiaId = parseInt(req.params.id);

        const existingMateria = await prisma.materia.findFirst({
            where: { clave: materiaId },
            include: {
                Grupos: {
                    where: {
                        Periodo: {
                            activo: true
                        }
                    },
                    orderBy: {
                        id_grupo: 'desc'
                    },
                    take: 1,
                    include: {
                        Solicitudes: true
                    }
                }
            }
        });

        if (!existingMateria) {
            return res.status(400).json({ error: 'No existe la materia seleccionada' });
        }

        return res.status(200).json(existingMateria);

    } catch (error) {
        res.status(500).json({ message: 'Error al obtener materias' })
    }
}

export async function getAllMaterias(req: Request, res: Response) {
    try {
        const materiasResult = await prisma.materia.findMany({
            include: {
                area: {
                    select: {
                        nombre: true,
                        url: true,
                        id_area: true
                    }
                },
                Carreras: {
                    select: {
                        abreviatura: true
                    }
                },
                Grupos: {
                    where: {
                        Periodo: {
                            activo: true
                        }
                    },
                    take: 1,
                }
            },
        });

        materiasResult.sort((a, b) => {
            if (a.Grupos.length > 0 && b.Grupos.length > 0) {
                return b.Grupos[0].inscritos - a.Grupos[0].inscritos;
            }

            if (a.Grupos.length === 0) {
                return 1;
            }

            if (b.Grupos.length === 0) {
                return -1;
            }

            return 0;
        });

        interface GroupData {
            grupo_id: number;
            clave_materia: number;
            nombre_materia: string;
            area: string;
            area_img: string;
            inscritos: number;
            carreras: string[];
            horario?: string;
            profesor?: string;
            costo?: Decimal;
        }

        interface Materia {
            clave: string;
            nombre: string;
            carreras: string[];
            grupo?: GroupData;
            area_id: number;
        }

        const materias: Materia[] = materiasResult.map(materia => {
            return {
                carreras: materia.Carreras.map((carrera) => carrera.abreviatura),
                clave: materia.clave.toString(),
                nombre: materia.nombre!,
                area_id: materia.area.id_area,
                grupo: materia.Grupos.length > 0 ? {
                    grupo_id: materia.Grupos[0].id_grupo,
                    clave_materia: materia.clave,
                    nombre_materia: materia.nombre,
                    area: materia.area.nombre,
                    area_img: materia.area?.url,
                    inscritos: materia.Grupos[0].inscritos,
                    horario: materia.Grupos[0].hora_inicio && materia.Grupos[0].hora_fin ? `${materia.Grupos[0].hora_inicio} - ${materia.Grupos[0].hora_fin}` : undefined,
                    profesor: materia.Grupos[0].profesor || undefined,
                    costo: materia.Grupos[0].costo || undefined,
                    carreras: materia.Carreras.map((carrera) => carrera.abreviatura),
                } : undefined,
            }
        });

        return res.status(200).json({ message: 'Materias encontradas', data: materias, code: "OK" });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener materias' });
        console.error(error);
    }
}

export async function getGroupsAdmin(req: Request, res: Response) {
    try {
        const groupsResult = await prisma.grupo.findMany({
            include: {
                materia: {
                    include: {
                        area: true,
                        Carreras: true
                    },
                },
            },
            where: {
                Periodo: {
                    activo: true
                }
            }
        });

        const groups = groupsResult.map(group => {
            return {
                id_grupo: group.id_grupo,
                clave_materia: group.materia?.clave,
                nombre_materia: group.materia?.nombre,
                area: group.materia?.area?.nombre,
                area_img: group.materia?.area?.url,
                inscritos: group.inscritos,
                horario: group.hora_inicio && group.hora_fin ? `${group.hora_inicio} - ${group.hora_fin}` : "No definido",
                carreras: group.materia?.Carreras.map((carrera) => carrera.abreviatura),
                profesor: group.profesor || "No definido",
                costo: group.costo || "No definido",
            }
        });

        return res.status(200).json({ message: 'Grupos encontrados', data: groups, code: "OK" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al obtener los grupos' });
    }
}

export async function createGroupAdmin(req: Request, res: Response) {
    try {
        const { claveMateria, costo, profesor, hora_inicio, hora_fin } = req.body;

        if (!claveMateria) {
            return res.status(400).json({ error: 'La clave de materia es obligatoria' });
        }

        const periodoActivo = await prisma.periodo.findFirst({
            where: {
                activo: true
            }
        });

        if (!periodoActivo) {
            return res.status(400).json({ error: 'No hay un periodo activo' });
        }

        const existingGroup = await prisma.grupo.findFirst({
            where: {
                clave_materia: claveMateria,
                id_periodo: periodoActivo.id_periodo
            }
        });

        if (existingGroup) {
            return res.status(400).json({ message: 'Ya existe un grupo con la clave de materia especificada' });
        }

        const newGroup = await prisma.grupo.create({
            data: {
                admin_created: true,
                clave_materia: claveMateria,
                costo: costo,
                profesor: profesor,
                hora_inicio: hora_inicio,
                hora_fin: hora_fin,
                id_periodo: periodoActivo.id_periodo,
            },
        });

        return res.status(201).json({ message: 'Grupo creado correctamente', data: newGroup, code: "OK" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al crear el grupo' });
    }
}

// PERIODOS
export async function getPeriodos(req: Request, res: Response) {
    try {
        const periodos = await prisma.periodo.findMany({
            orderBy: {
                id_periodo: 'desc'
            }
        });

        return res.status(200).json({ message: 'Periodos encontrados', data: periodos, code: "OK" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al obtener los periodos' });
    }
}

export async function createPeriodo(req: Request, res: Response) {
    try {
        const currentDate = new Date();
        const nombre = `verano_${currentDate.getFullYear()}`;

        const existingPeriodo = await prisma.periodo.findFirst({
            where: {
                nombre: nombre
            }
        });

        const newPeriodo = await prisma.periodo.create({
            data: {
                nombre: nombre,
                activo: true
            },
        });

        // deactivate previous periods
        await prisma.periodo.updateMany({
            where: {
                id_periodo: {
                    not: newPeriodo.id_periodo
                }
            },
            data: {
                activo: false
            }
        });

        return res.status(201).json({ message: 'Periodo creado correctamente', data: newPeriodo, code: "OK" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al crear el periodo' });
    }
}

export async function updatePeriodo(req: Request, res: Response) {
    try {
        const latestPeriodo = await prisma.periodo.findFirst({
            where: {
                activo: true
            }
        });

        const updatedPeriodo = await prisma.periodo.update({
            where: { id_periodo: latestPeriodo?.id_periodo },
            data: {
                activo: !latestPeriodo?.activo
            },
        });

        return res.status(200).json({ message: 'Periodo actualizado correctamente', data: updatedPeriodo, code: "OK" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al actualizar el periodo' });
    }
}