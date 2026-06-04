export class InvalidCredentialsError extends Error {
  constructor(message = "Credenciales inválidas") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

export class EmailAlreadyExistsError extends Error {
  constructor(message = "El email ya está registrado") {
    super(message);
    this.name = "EmailAlreadyExistsError";
  }
}

export class InactiveAccountError extends Error {
  constructor(message = "La cuenta está inactiva") {
    super(message);
    this.name = "InactiveAccountError";
  }
}

export class InvalidTokenError extends Error {
  constructor(message = "Token inválido o expirado") {
    super(message);
    this.name = "InvalidTokenError";
  }
}

export class WeakPasswordError extends Error {
  constructor(message = "La contraseña no cumple los requisitos mínimos") {
    super(message);
    this.name = "WeakPasswordError";
  }
}
