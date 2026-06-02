use std::sync::Mutex;

#[derive(Default)]
pub struct DbState {
    pub _conn: Mutex<Option<()>>,
}
