import {createApp} from 'vue';
import Toast from './Toast.vue';

const showToast = (msg, options = {duration: 1500}) => {
    const {duration} = options;
    const div = document.createElement('div');
    const componentInstance = createApp(Toast, {
        show: true,
        msg,
        duration,
    });

    componentInstance.mount(div);
    document.body.appendChild(div);

    let timer = null;
    clearTimeout(timer);
    timer = setTimeout(() => {
        componentInstance.unmount(div);
        document.body.removeChild(div);
    }, duration);
};

export default showToast;
