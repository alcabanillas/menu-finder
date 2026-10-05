## ADDED Requirements

### Requirement: Sign-in errors are announced every time
The sign-in form SHALL show the message the server returns in an element with the alert role inside the form, and SHALL replace that element with a new one on every answer, so that assistive technology announces the message each time, also when it is the same as the previous one.

#### Scenario: An error is announced
- **WHEN** a sign-in is submitted and the server answers with a message
- **THEN** the form shows an alert with that message

#### Scenario: The same error twice in a row is announced again
- **WHEN** two sign-ins in a row get the same message from the server
- **THEN** after the second answer the alert is a different element from the one shown after the first, with the same text

#### Scenario: No alert before the first answer
- **WHEN** the sign-in form is rendered and nothing has been submitted
- **THEN** the form has no alert

### Requirement: The sign-in form checks the fields before sending
The sign-in form SHALL check, when it is submitted, that the email is not empty, that it has the shape of an address (text, `@`, text, a dot, text, with no spaces), and that the password is not empty. A field that fails SHALL show a message under it ("Escribe tu correo.", "Revisa el formato del correo." or "Escribe tu contraseña."), SHALL be marked invalid and linked to its message for assistive technology, and nothing SHALL be sent to the server. These checks SHALL only look at what was typed. They do not replace the validation on the server, which SHALL hold when the form is sent without them.

#### Scenario: Empty fields
- **WHEN** the form is submitted with both fields empty
- **THEN** the email shows "Escribe tu correo.", the password shows "Escribe tu contraseña.", both are marked invalid, and the server action is not called

#### Scenario: An email without the shape of an address
- **WHEN** the form is submitted with the email `ana@correo` and a password
- **THEN** the email shows "Revisa el formato del correo." and the server action is not called

#### Scenario: Valid fields are sent
- **WHEN** the form is submitted with `ana@example.test` and a password
- **THEN** no field message is shown and the server action receives both values

#### Scenario: The server holds without the form checks
- **WHEN** the form is sent with JavaScript disabled and an email such as `' OR 1=1; --`
- **THEN** the server answers with the wrong-credentials message, as without the checks

### Requirement: The password can be shown
The password field SHALL have a control, labelled "Mostrar" while the password is hidden and "Ocultar" while it is shown, that switches the field between hidden and visible text and reports its state to assistive technology as pressed or not pressed. The password SHALL be hidden when the form is rendered. The control SHALL NOT submit the form.

#### Scenario: Hidden by default
- **WHEN** the sign-in form is rendered
- **THEN** the password field is of type `password` and the control says "Mostrar" and is not pressed

#### Scenario: Shown and hidden again
- **WHEN** the user activates the control, and then activates it again
- **THEN** the field shows the text and the control says "Ocultar" and is pressed; then the field hides it again and the control says "Mostrar"

#### Scenario: The control does not submit
- **WHEN** the user activates the control with both fields filled in
- **THEN** the server action is not called

### Requirement: The sign-in form shows that it is working
While a sign-in is in flight, the submit button SHALL say "Entrando…" and SHALL be disabled, so the form cannot be sent twice.

#### Scenario: Pending sign-in
- **WHEN** a valid sign-in has been submitted and the server has not answered yet
- **THEN** the button says "Entrando…" and is disabled
