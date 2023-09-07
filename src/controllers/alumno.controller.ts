import { Request, Response } from "express";

export const crearSolicitud = async (req: Request, res: Response) => {
    const {expediente, nombre_alumno, ap_paterno, ap_materno, email_alumno} = req.body
    try {
        const [rows] = await pool.query('INSERT INTO Solicitud (expediente, nombre_alumno, ap_paterno, ap_materno, email_alumno) VALUES (?, ?, ?, ?, ?)'
        , [expediente, nombre_alumno, ap_paterno, ap_materno, email_alumno])
        res.send('Solicitud creada correctamente.')
        res.json(rows[0])
    } catch (error) {
        res.status(500).json({message: "Algo salió mal."})
    }
}