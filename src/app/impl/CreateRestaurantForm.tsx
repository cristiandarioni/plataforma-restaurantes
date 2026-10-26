"use client";

import { useActionState } from "react";
import { createRestaurant } from "./actions";

export function CreateRestaurantForm() {
  const [error, action, pending] = useActionState(createRestaurant, null);
  return (
    <form action={action} className="stack">
      <div className="grid2">
        <label className="field">
          Nombre del restaurante
          <input type="text" name="name" required />
        </label>
        <label className="field">
          Dirección web (opcional, se genera del nombre)
          <input type="text" name="slug" placeholder="donde-raiz" />
        </label>
        <label className="field">
          Clave del administrador
          <input type="text" name="password" minLength={6} required />
        </label>
        <label className="field">
          Número de mesas
          <input type="number" name="tables" min={0} max={100} defaultValue={8} />
        </label>
        <label className="field">
          Turnos
          <select name="shifts" defaultValue="uno">
            <option value="uno">Un turno (una sola carta)</option>
            <option value="dos">Dos turnos: almuerzo y cena</option>
          </select>
        </label>
        <label className="field">
          ¿Tiene menú del día que cambia a diario?
          <select name="daily" defaultValue="no">
            <option value="no">No, menú fijo</option>
            <option value="si">Sí</option>
          </select>
        </label>
      </div>
      {error && <p className="pill pill-bad">{error}</p>}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Creando…" : "Crear restaurante"}
      </button>
    </form>
  );
}
