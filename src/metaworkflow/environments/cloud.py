import json
import sys, os
from pathlib import Path
import uuid

if __name__ == '__main__':
    TMP_NAME = sys.argv.pop()
    TMP = Path(os.environ.get(TMP_NAME, '/tmp'))
    LIB = sys.argv.pop()
    # TMP = Path("/home/phyberos/project-rpp/gene_centric_analysis_pipeline/scratch/cloud_compute/cache/tmp")
    
    CLOUD_SPACE: Path|None = None
    while CLOUD_SPACE is None or CLOUD_SPACE.exists():
        CLOUD_SPACE = TMP.joinpath(f'metaworkflow-{uuid.uuid4().hex}')
    CLOUD_WS = CLOUD_SPACE.joinpath('workspace')
    CLOUD_LIB = CLOUD_SPACE.joinpath('lib')
    os.makedirs(CLOUD_WS)
    os.chdir(CLOUD_WS)
    os.system(f'mkdir -p {CLOUD_LIB} && tar -hxf {LIB} -C {CLOUD_LIB}')

    sys.path = list(set([str(CLOUD_LIB)]+sys.path))
    from _setup import ParseArgs
    e = ParseArgs(sys.path)
    MODULE_PATH, WORKSPACE, RELATIVE_OUTPUT_PATH, CONTEXT, THIS_MODULE = e.module_path, e.workspace, e.relative_output_path, e.context, e.module
    os.makedirs(RELATIVE_OUTPUT_PATH)

    unzipped = set()
    for item, ps in CONTEXT.manifest.items():
        if not isinstance(ps, list): ps = [ps]
        for p in ps:
            toks = str(p).split('/')
            folder = toks[0]
            output = '/'.join(toks[:2])
            if not os.path.exists(folder): os.makedirs(folder)
            if output in unzipped: continue
            os.system(f"cd {folder} && tar -hxf {WORKSPACE.joinpath(f'{output}.tgz')}")
            unzipped.add(output)

    import metaworkflow.environments.local as env
    from metaworkflow.common.utils import LiveShell

    cmd_history = []
    err_log, out_log = [], []
    def _shell(cmd: str):
        lines = cmd.split('\n')
        for line in lines:
            line = line.strip()
            if line == "": continue
            cmd_history.append(line)
            def _on_io(s: str, log: list):
                if s.endswith('\n'): s = s[:-1]
                log.append(s)

        LiveShell(
            cmd, echo_cmd=False,
            onOut=lambda s: _on_io(s, out_log),
            onErr=lambda s: _on_io(s, err_log),
        )

    # print(sys.argv, metaworkflow.__name__)
    lib_name = env.__name__
    module_name = str(MODULE_PATH).split('/')[-1]
    _shell(f"""\
        echo $(date) "setting up env"
        cp -r {MODULE_PATH} {CLOUD_LIB}/
        cd {CLOUD_WS}
        cp {WORKSPACE.joinpath(RELATIVE_OUTPUT_PATH)}/*.json {RELATIVE_OUTPUT_PATH}/
        ls -lh
        echo $(date) "starting"
        python {env.__file__} {CLOUD_LIB}/{module_name} {CLOUD_WS} {RELATIVE_OUTPUT_PATH} \
    """.replace("  ", ""))

    BL = {
        'context.json',
        'result.json'
    }
    outs = [f for f in os.listdir(RELATIVE_OUTPUT_PATH) if f not in BL]
    newline = '\n'
    _shell(f"""\
        echo $(date) "gathering results"
        cd {RELATIVE_OUTPUT_PATH}
        ls -lh
        {newline.join(f"tar -cf - {f} | pigz -5 -p {CONTEXT.params.threads} >{Path(WORKSPACE).joinpath(RELATIVE_OUTPUT_PATH)}/{f}.tgz" for f in outs)}
        echo $(date) "done"
    """.replace("  ", ""))

    result_json = 'result.json'
    with open(RELATIVE_OUTPUT_PATH.joinpath(result_json)) as j:
        res = json.load(j)
        res['cloud-wrapper_commands'] = cmd_history
        res['cloud-wrapper_out'] = out_log
        res['cloud-wrapper_err'] = err_log
        with open(WORKSPACE.joinpath(RELATIVE_OUTPUT_PATH).joinpath(result_json), 'w') as outj:
            json.dump(res, outj, indent=4)
